const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export interface YouTubeLiveVideo {
  id: { videoId: string };
  snippet: { title: string };
}

// Given a UC channel ID, fetches the channel page and extracts the canonical
// @handle. Returns null on any failure so callers can fall back to the UC id.
export async function resolveYouTubeHandleFromChannelId(channelId: string): Promise<string | null> {
  const trimmed = channelId.replace(/^@/, '');
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(trimmed)) return null;

  try {
    const response = await fetch(`https://www.youtube.com/channel/${trimmed}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    if (!response.ok) return null;
    const html = await response.text();
    // The channel metadata embeds a `vanityChannelUrl` pointing at the canonical
    // /@handle URL whenever the channel has claimed a handle.
    const match = html.match(/"vanityChannelUrl":"https?:\\?\/\\?\/(?:www\.)?youtube\.com\\?\/(@[^"\\/]+)"/i);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export async function getYouTubeLiveVideos(channelKey: string): Promise<YouTubeLiveVideo[]> {
  const url = buildStreamsUrl(channelKey);

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(`YouTube page fetch failed with ${response.status}`);
  }

  const html = await response.text();
  const data = extractYtInitialData(html);
  if (!data) return [];

  const results: YouTubeLiveVideo[] = [];
  const seen = new Set<string>();
  findLiveVideos(data, results, seen);
  return results;
}

function buildStreamsUrl(channelKey: string): string {
  const trimmed = channelKey.replace(/^@/, '');
  // Channel IDs always start with "UC" followed by 22 base64-ish chars.
  if (/^UC[A-Za-z0-9_-]{22}$/.test(trimmed)) {
    return `https://www.youtube.com/channel/${trimmed}/streams`;
  }
  return `https://www.youtube.com/@${trimmed}/streams`;
}

function extractYtInitialData(html: string): unknown {
  const marker = 'var ytInitialData = ';
  const start = html.indexOf(marker);
  if (start === -1) return null;

  const jsonStart = start + marker.length;
  let depth = 0;
  let end = jsonStart;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  try {
    return JSON.parse(html.slice(jsonStart, end)) as unknown;
  } catch {
    return null;
  }
}

function findLiveVideos(obj: unknown, results: YouTubeLiveVideo[], seen: Set<string>): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (const item of obj) findLiveVideos(item, results, seen);
    return;
  }

  const record = obj as Record<string, unknown>;

  // New format: lockupViewModel for a live video.
  if (
    typeof record.contentId === 'string' &&
    record.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO' &&
    hasLiveBadge(record)
  ) {
    if (!seen.has(record.contentId)) {
      seen.add(record.contentId);
      results.push({
        id: { videoId: record.contentId },
        snippet: { title: extractLockupTitle(record) }
      });
    }
    return;
  }

  // Legacy format: videoRenderer with a LIVE thumbnail overlay.
  if (typeof record.videoId === 'string' && Array.isArray(record.thumbnailOverlays)) {
    const isLive = record.thumbnailOverlays.some((overlay: unknown) => {
      if (!overlay || typeof overlay !== 'object') return false;
      const tots = (overlay as Record<string, unknown>)
        .thumbnailOverlayTimeStatusRenderer as Record<string, unknown> | undefined;
      return tots?.style === 'LIVE';
    });

    if (isLive && !seen.has(record.videoId)) {
      seen.add(record.videoId);
      results.push({
        id: { videoId: record.videoId },
        snippet: { title: extractText(record.title) }
      });
      return;
    }
  }

  for (const value of Object.values(record)) {
    findLiveVideos(value, results, seen);
  }
}

function hasLiveBadge(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (Array.isArray(obj)) return obj.some(hasLiveBadge);
  const record = obj as Record<string, unknown>;
  if (record.badgeStyle === 'THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE') return true;
  return Object.values(record).some(hasLiveBadge);
}

function extractLockupTitle(record: Record<string, unknown>): string {
  const metadata = record.metadata as Record<string, unknown> | undefined;
  const lmv = metadata?.lockupMetadataViewModel as Record<string, unknown> | undefined;
  const title = lmv?.title as Record<string, unknown> | undefined;
  if (typeof title?.content === 'string') return title.content;
  return '';
}

function extractText(obj: unknown): string {
  if (!obj || typeof obj !== 'object') return '';
  const r = obj as Record<string, unknown>;
  if (typeof r.simpleText === 'string') return r.simpleText;
  if (Array.isArray(r.runs) && r.runs[0]) {
    const run = r.runs[0] as Record<string, unknown>;
    if (typeof run.text === 'string') return run.text;
  }
  return '';
}
