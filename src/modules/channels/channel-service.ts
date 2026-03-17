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
import { ChannelRepository } from './channel-repository.js';
import { SettingsService } from '../settings/settings-service.js';
import { LogService } from '../logging/log-service.js';

export class ChannelService {
  constructor(
    private readonly repository: ChannelRepository,
    private readonly settings: SettingsService,
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
      enabled: channel.enabled,
      pollIntervalMinutes: channel.pollIntervalMinutes,
      priority: channel.priority
    }));
  }

  create(input: CreateChannelInput): Channel {
    const { parsed, platform, normalized } = this.normalizeCreateInput(input);
    const channel: Channel = {
      id: makeId(),
      platform,
      channelKey: normalized.channelKey,
      displayName: parsed.displayName ?? normalized.displayName,
      url: normalized.url,
      enabled: true,
      pollIntervalMinutes:
        parsed.pollIntervalMinutes ?? this.settings.get().defaultPollIntervalMinutes,
      priority: parsed.priority ?? 100,
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

  importItems(entries: unknown): Omit<ImportChannelsResult, 'path'> {
    const parsedEntries = channelTransferListSchema.parse(entries);
    const known = new Set(
      this.repository
        .list()
        .map((channel) => `${channel.platform}:${channel.channelKey.toLowerCase()}`)
    );

    let imported = 0;
    let skipped = 0;

    for (const entry of parsedEntries) {
      const { platform, normalized } = this.normalizeCreateInput(entry);
      const dedupeKey = `${platform}:${normalized.channelKey.toLowerCase()}`;
      if (known.has(dedupeKey)) {
        skipped += 1;
        continue;
      }

      const created = this.create(entry);
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

  private normalizeCreateInput(input: CreateChannelInput | ChannelTransferItem): {
    parsed: CreateChannelInput;
    platform: Channel['platform'];
    normalized: ReturnType<(typeof adapters)[Channel['platform']]['normalizeInput']>;
  } {
    const parsed = createChannelSchema.parse(input);
    const platform = parsed.platform ?? this.detectPlatform(parsed.value);
    const adapter = adapters[platform];
    const normalized = adapter.normalizeInput(parsed.value);
    return { parsed, platform, normalized };
  }

  private detectPlatform(value: string): Channel['platform'] {
    const normalized = value.trim().toLowerCase();
    if (normalized.includes('youtube.com') || normalized.includes('youtu.be') || normalized.startsWith('@')) {
      return 'youtube';
    }
    if (normalized.includes('kick.com')) {
      return 'kick';
    }
    return 'twitch';
  }
}
