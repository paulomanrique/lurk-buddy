import type { BrowserWindow } from 'electron';
import { POLL_TICK_MS } from '../../shared/constants.js';
import type { Channel, Platform } from '../../shared/types.js';

const PLATFORM_POLL_MINUTES: Record<Platform, number> = {
  twitch: 5,
  kick: 5,
  youtube: 10,
  tiktok: 5,
};
import { adapters } from '../../platforms/index.js';
import { ChannelService } from '../channels/channel-service.js';
import { ChannelRepository } from '../channels/channel-repository.js';
import { LiveSessionService } from '../live-sessions/live-session-service.js';
import { LogService } from '../logging/log-service.js';
import { PollRunRepository } from './poll-run-repository.js';
import { SettingsService } from '../settings/settings-service.js';

const POLL_CONCURRENCY = 5;
const POLL_TIMEOUT_MS = 10_000;
const MAX_POLL_RETRIES = 5;

class PollTimeoutError extends Error {
  constructor() {
    super('Polling timed out');
    this.name = 'PollTimeoutError';
  }
}

export class PollingService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private currentTick: Promise<void> | null = null;
  private currentChannels = new Set<string>();
  private retryAttempts = new Map<string, number>();
  private timedOutChannels = new Set<string>();
  private completedChannels = new Set<string>();
  private sessionMaintenance: Promise<void> | null = null;
  private onStateChanged: (() => void) | null = null;
  private hasCompletedInitialSweep = false;
  private forcePollOnNextTick = false;

  constructor(
    private readonly channels: ChannelRepository,
    private readonly channelService: ChannelService,
    private readonly sessions: LiveSessionService,
    private readonly pollRuns: PollRunRepository,
    private readonly settings: SettingsService,
    private readonly logs: LogService
  ) {}

  bindStateChange(callback: () => void): void {
    this.onStateChanged = callback;
  }

  start(window: BrowserWindow): void {
    this.sessions.attachWindow(window);
    this.timer = setInterval(() => void this.tick(), POLL_TICK_MS);
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  currentChannelId(): string | null {
    return this.currentChannels.values().next().value ?? null;
  }

  currentChannelIds(): string[] {
    return [...this.currentChannels];
  }

  retryAttemptEntries(): Record<string, number> {
    return Object.fromEntries(this.retryAttempts);
  }

  timedOutChannelIds(): string[] {
    return [...this.timedOutChannels];
  }

  completedChannelIds(): string[] {
    return [...this.completedChannels];
  }

  async runNow(): Promise<void> {
    this.forcePollOnNextTick = true;
    await this.tick();
    if (this.forcePollOnNextTick) {
      await this.tick();
    }
  }

  async tick(): Promise<void> {
    if (this.running) {
      await this.currentTick;
      return;
    }

    this.running = true;
    this.currentChannels.clear();
    this.retryAttempts.clear();
    this.timedOutChannels.clear();
    this.completedChannels.clear();
    this.onStateChanged?.();
    this.currentTick = (async () => {
      const force = this.forcePollOnNextTick;
      this.forcePollOnNextTick = false;
      try {
        const settings = this.settings.get();
        const channels = this.channels.getEnabled();
        const channelsToPoll = channels
          .filter((channel) => force || this.shouldPoll(channel, this.hasCompletedInitialSweep))
          .sort((left, right) => this.compareChannelsAlphabetically(left, right));
        const workerCount = Math.min(POLL_CONCURRENCY, channelsToPoll.length);
        await Promise.all(
          Array.from({ length: workerCount }, (_, index) => this.runPollingWorker(channelsToPoll, index, workerCount, settings))
        );
        this.hasCompletedInitialSweep = true;
        this.runSessionMaintenance(settings.closeGracePeriodSeconds);
        this.onStateChanged?.();
      } finally {
        this.running = false;
        this.currentChannels.clear();
        this.retryAttempts.clear();
        this.timedOutChannels.clear();
        this.completedChannels.clear();
        this.currentTick = null;
        this.onStateChanged?.();
      }
    })();

    await this.currentTick;
  }

  private runSessionMaintenance(closeGracePeriodSeconds: number): void {
    if (this.sessionMaintenance) {
      return;
    }

    this.sessionMaintenance = this.sessions
      .checkPlaybackAndCloseEnded(closeGracePeriodSeconds)
      .catch((error) => {
        this.logs.write('error', 'polling', 'Session maintenance failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      })
      .finally(() => {
        this.sessionMaintenance = null;
      });
  }

  private shouldPoll(channel: Channel, hasCompletedInitialSweep: boolean): boolean {
    if (!hasCompletedInitialSweep) {
      return true;
    }
    if (!channel.lastPollAt) {
      return true;
    }
    const elapsed = Date.now() - new Date(channel.lastPollAt).getTime();
    return elapsed >= PLATFORM_POLL_MINUTES[channel.platform] * 60_000;
  }

  private compareChannelsAlphabetically(left: Channel, right: Channel): number {
    const leftLabel = (left.displayName || left.channelKey || left.url).toLocaleLowerCase();
    const rightLabel = (right.displayName || right.channelKey || right.url).toLocaleLowerCase();
    return leftLabel.localeCompare(rightLabel);
  }

  private async runPollingWorker(
    channelsToPoll: Channel[],
    workerIndex: number,
    workerCount: number,
    settings: ReturnType<SettingsService['get']>
  ): Promise<void> {
    for (let index = workerIndex; index < channelsToPoll.length; index += workerCount) {
      const channel = channelsToPoll[index];
      this.currentChannels.add(channel.id);
      this.onStateChanged?.();

      const adapter = adapters[channel.platform];
      try {
        const status = await this.pollChannelWithRetry(channel);
        this.channelService.touchPoll(channel.id);
        if (status.isLive) {
          this.pollRuns.record(channel.id, 'live', status.title);
          if (settings.autoOpenLives) {
            const urls = status.allWatchUrls?.length
              ? status.allWatchUrls
              : [adapter.buildWatchUrl(channel, status)];
            for (const url of urls) {
              await this.sessions.ensureSession(channel, url);
            }
            await this.sessions.closeStaleSessionsForChannel(channel.id, urls, settings.closeGracePeriodSeconds);
          }
        } else {
          this.pollRuns.record(channel.id, 'offline');
          await this.sessions.closeByChannelId(channel.id, settings.closeGracePeriodSeconds);
        }
      } catch (error) {
        const detail =
          error instanceof PollTimeoutError
            ? 'timeout'
            : error instanceof Error
              ? error.message
              : 'Unknown error';
        this.pollRuns.record(channel.id, 'error', detail);
        if (error instanceof PollTimeoutError) {
          this.timedOutChannels.add(channel.id);
        }
        this.logs.write('error', 'polling', 'Polling failed', {
          channelId: channel.id,
          error: detail
        });
      } finally {
        this.currentChannels.delete(channel.id);
        this.retryAttempts.delete(channel.id);
        this.completedChannels.add(channel.id);
        this.onStateChanged?.();
      }
    }
  }

  private async pollChannelWithRetry(channel: Channel) {
    const adapter = adapters[channel.platform];

    for (let attempt = 0; attempt <= MAX_POLL_RETRIES; attempt += 1) {
      try {
        if (attempt > 0) {
          this.retryAttempts.set(channel.id, attempt);
          this.onStateChanged?.();
        }
        return await this.withTimeout(adapter.getChannelStatus(channel), POLL_TIMEOUT_MS);
      } catch (error) {
        if (!(error instanceof PollTimeoutError)) {
          throw error;
        }
        if (attempt === MAX_POLL_RETRIES) {
          throw error;
        }
      }
    }

    throw new PollTimeoutError();
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return await new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new PollTimeoutError());
      }, timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timeoutId);
          resolve(value);
        },
        (error) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      );
    });
  }
}
