import type { Channel, CreateChannelInput, TestChannelResult, UpdateChannelInput } from '../../shared/types.js';
import { createChannelSchema, updateChannelSchema } from '../../shared/schemas.js';
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

  create(input: CreateChannelInput): Channel {
    const parsed = createChannelSchema.parse(input);
    const adapter = adapters[parsed.platform];
    const normalized = adapter.normalizeInput(parsed.value);
    const channel: Channel = {
      id: makeId(),
      platform: parsed.platform,
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
}
