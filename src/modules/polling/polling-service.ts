import type { BrowserWindow } from 'electron';
import { POLL_TICK_MS } from '../../shared/constants.js';
import type { Channel, Platform } from '../../shared/types.js';

const PLATFORM_POLL_MINUTES: Record<Platform, number> = {
  twitch: 5,
  kick: 5,
  youtube: 10,
};
import { adapters } from '../../platforms/index.js';
import { ChannelService } from '../channels/channel-service.js';
import { ChannelRepository } from '../channels/channel-repository.js';
import { LiveSessionService } from '../live-sessions/live-session-service.js';
import { LogService } from '../logging/log-service.js';
import { PollRunRepository } from './poll-run-repository.js';
import { SettingsService } from '../settings/settings-service.js';

export class PollingService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
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

  async runNow(): Promise<void> {
    this.forcePollOnNextTick = true;
    await this.tick();
  }

  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    const force = this.forcePollOnNextTick;
    this.forcePollOnNextTick = false;
    try {
      const settings = this.settings.get();
      const channels = this.channels.getEnabled();
      let activeCount = this.sessions.active().length;
      for (const channel of channels) {
        if (!force && !this.shouldPoll(channel, this.hasCompletedInitialSweep)) {
          continue;
        }
        const adapter = adapters[channel.platform];
        try {
          const status = await adapter.getChannelStatus(channel);
          this.channelService.touchPoll(channel.id);
          if (status.isLive) {
            this.pollRuns.record(channel.id, 'live', status.title);
            if (settings.autoOpenLives) {
              const urls = status.allWatchUrls?.length
                ? status.allWatchUrls
                : [adapter.buildWatchUrl(channel, status)];
              for (const url of urls) {
                await this.sessions.ensureSession(channel, url);
                activeCount += 1;
              }
              await this.sessions.closeStaleSessionsForChannel(channel.id, urls, settings.closeGracePeriodSeconds);
            }
          } else {
            this.pollRuns.record(channel.id, 'offline');
            await this.sessions.closeByChannelId(channel.id, settings.closeGracePeriodSeconds);
          }
        } catch (error) {
          this.pollRuns.record(channel.id, 'error', error instanceof Error ? error.message : 'Unknown error');
          this.logs.write('error', 'polling', 'Polling failed', {
            channelId: channel.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      await this.sessions.checkPlaybackAndCloseEnded(settings.closeGracePeriodSeconds);
      this.hasCompletedInitialSweep = true;
      this.onStateChanged?.();
    } finally {
      this.running = false;
    }
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
}
