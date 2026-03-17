import { runtimeEnv } from '../../main/env.js';

interface YouTubeSearchResponse {
  items: Array<{
    id?: {
      channelId?: string;
      videoId?: string;
    };
    snippet?: {
      title?: string;
      channelTitle?: string;
    };
  }>;
}

const channelIdCache = new Map<string, string>();

export async function getYouTubeLiveVideo(channelKey: string): Promise<YouTubeSearchResponse['items'][number] | null> {
  if (!runtimeEnv.youtubeApiKey) {
    return null;
  }

  const channelId = await resolveYouTubeChannelId(channelKey);
  if (!channelId) {
    return null;
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('channelId', channelId);
  url.searchParams.set('eventType', 'live');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('key', runtimeEnv.youtubeApiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`YouTube search API failed with ${response.status}`);
  }

  const payload = (await response.json()) as YouTubeSearchResponse;
  return payload.items[0] ?? null;
}

async function resolveYouTubeChannelId(channelKey: string): Promise<string | null> {
  const normalized = channelKey.trim();
  if (channelIdCache.has(normalized)) {
    return channelIdCache.get(normalized)!;
  }

  if (normalized.startsWith('UC')) {
    channelIdCache.set(normalized, normalized);
    return normalized;
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'channel');
  url.searchParams.set('maxResults', '1');
  url.searchParams.set('q', normalized.replace(/^@/, ''));
  url.searchParams.set('key', runtimeEnv.youtubeApiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`YouTube channel lookup failed with ${response.status}`);
  }

  const payload = (await response.json()) as YouTubeSearchResponse;
  const channelId = payload.items[0]?.id?.channelId ?? null;
  if (channelId) {
    channelIdCache.set(normalized, channelId);
  }
  return channelId;
}
