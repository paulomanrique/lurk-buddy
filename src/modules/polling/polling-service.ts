import type { BrowserWindow } from 'electron';
import { POLL_TICK_MS } from '../../shared/constants.js';
import type { Channel } from '../../shared/types.js';
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

  async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const settings = this.settings.get();
      const channels = this.channels.getEnabled();
      let activeCount = this.sessions.active().length;
      for (const channel of channels) {
        if (!this.shouldPoll(channel)) {
          continue;
        }
        const adapter = adapters[channel.platform];
        try {
          const status = await adapter.getChannelStatus(channel);
          this.channelService.touchPoll(channel.id);
          if (status.isLive) {
            this.pollRuns.record(channel.id, 'live', status.title);
            if (settings.autoOpenLives && activeCount < settings.maxConcurrentLives) {
              await this.sessions.ensureSession(channel, adapter.buildWatchUrl(channel, status));
              activeCount += 1;
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
      this.onStateChanged?.();
    } finally {
      this.running = false;
    }
  }

  private shouldPoll(channel: Channel): boolean {
    if (!channel.lastPollAt) {
      return true;
    }
    const elapsed = Date.now() - new Date(channel.lastPollAt).getTime();
    return elapsed >= channel.pollIntervalMinutes * 60_000;
  }
}
