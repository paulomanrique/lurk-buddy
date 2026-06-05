import type {
  Channel,
  ChannelTransferItem,
  CreateChannelInput,
  ImportChannelsResult,
  TestChannelResult,
  UpdateChannelInput
} from '../../shared/types.js';
import { channelTransferListSchema, createChannelSchema, updateChannelSchema } from '../../shared/schemas.js';
import { makeId, nowIso } from '../../shared/utils.js';
import { adapters } from '../../platforms/index.js';
import { resolveYouTubeHandleFromChannelId } from '../platform-api/youtube-api.js';
import { ChannelRepository } from './channel-repository.js';
import { LogService } from '../logging/log-service.js';

export class ChannelService {
  constructor(
    private readonly repository: ChannelRepository,
    private readonly logs: LogService
  ) {}

  list(): Channel[] {
    return this.repository.list();
  }

  exportItems(): ChannelTransferItem[] {
    return this.repository.list().map((channel) => ({
      platform: channel.platform,
      value: channel.url,
      displayName: channel.displayName,
      enabled: channel.enabled
    }));
  }

  async create(input: CreateChannelInput): Promise<Channel> {
    const { parsed, platform, normalized } = await this.normalizeCreateInput(input);
    const existing = this.repository.getByPlatformAndChannelKey(platform, normalized.channelKey);
    if (existing) {
      throw new Error('This channel is already being tracked.');
    }
    const channel: Channel = {
      id: makeId(),
      platform,
      channelKey: normalized.channelKey,
      displayName: parsed.displayName ?? normalized.displayName,
      url: normalized.url,
      enabled: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastPollAt: null
    };
    const saved = this.repository.save(channel);
    this.logs.write('info', 'channels', 'Channel created', {
      platform: saved.platform,
      channelKey: saved.channelKey
    });
    return saved;
  }

  async importItems(entries: unknown): Promise<Omit<ImportChannelsResult, 'path'>> {
    const parsedEntries = channelTransferListSchema.parse(entries);
    const known = new Set(
      this.repository
        .list()
        .map((channel) => `${channel.platform}:${channel.channelKey.toLowerCase()}`)
    );

    let imported = 0;
    let skipped = 0;

    for (const entry of parsedEntries) {
      const { platform, normalized } = await this.normalizeCreateInput(entry);
      const dedupeKey = `${platform}:${normalized.channelKey.toLowerCase()}`;
      if (known.has(dedupeKey)) {
        skipped += 1;
        continue;
      }

      const created = await this.create(entry);
      known.add(dedupeKey);

      if (entry.enabled === false) {
        this.update(created.id, { enabled: false });
      }

      imported += 1;
    }

    this.logs.write('info', 'channels', 'Channels imported', {
      total: parsedEntries.length,
      imported,
      skipped
    });

    return {
      total: parsedEntries.length,
      imported,
      skipped
    };
  }

  update(id: string, patch: UpdateChannelInput): Channel {
    const parsed = updateChannelSchema.parse(patch);
    const current = this.requireChannel(id);
    const next: Channel = {
      ...current,
      ...parsed,
      updatedAt: nowIso()
    };
    const saved = this.repository.update(next);
    this.logs.write('info', 'channels', 'Channel updated', { id });
    return saved;
  }

  toggle(id: string, enabled: boolean): Channel {
    return this.update(id, { enabled });
  }

  delete(id: string): void {
    this.requireChannel(id);
    this.repository.delete(id);
    this.logs.write('warn', 'channels', 'Channel deleted', { id });
  }

  async test(id: string): Promise<TestChannelResult> {
    const channel = this.requireChannel(id);
    const adapter = adapters[channel.platform];
    const status = await adapter.getChannelStatus(channel);
    return {
      normalizedUrl: adapter.buildWatchUrl(channel, status),
      status
    };
  }

  touchPoll(id: string): void {
    const channel = this.requireChannel(id);
    this.repository.update({
      ...channel,
      lastPollAt: nowIso(),
      updatedAt: nowIso()
    });
  }

  private requireChannel(id: string): Channel {
    const channel = this.repository.getById(id);
    if (!channel) {
      throw new Error(`Channel not found: ${id}`);
    }
    return channel;
  }

  private async normalizeCreateInput(input: CreateChannelInput | ChannelTransferItem): Promise<{
    parsed: CreateChannelInput;
    platform: Channel['platform'];
    normalized: ReturnType<(typeof adapters)[Channel['platform']]['normalizeInput']>;
  }> {
    const parsed = createChannelSchema.parse(input);
    const platform = parsed.platform ?? this.detectPlatform(parsed.value);
    const adapter = adapters[platform];
    let normalized = adapter.normalizeInput(parsed.value);

    if (platform === 'youtube') {
      const stripped = normalized.channelKey.replace(/^@/, '');
      if (/^UC[A-Za-z0-9_-]{22}$/.test(stripped)) {
        const handle = await resolveYouTubeHandleFromChannelId(stripped);
        if (handle) {
          normalized = adapter.normalizeInput(handle);
        }
      }
    }

    return { parsed, platform, normalized };
  }

  private detectPlatform(value: string): Channel['platform'] {
    const normalized = value.trim().toLowerCase();
    if (normalized.includes('tiktok.com')) {
      return 'tiktok';
    }
    if (normalized.includes('instagram.com')) {
      return 'instagram';
    }
    // Match x.com only at a host boundary (^, // or .) so e.g. "vox.com" is not caught.
    if (normalized.includes('twitter.com') || /(?:^|\/\/|\.)x\.com(?:\/|$|\?)/.test(normalized)) {
      return 'twitter';
    }
    if (normalized.includes('youtube.com') || normalized.includes('youtu.be') || normalized.startsWith('@')) {
      return 'youtube';
    }
    if (normalized.includes('kick.com')) {
      return 'kick';
    }
    return 'twitch';
  }
}
