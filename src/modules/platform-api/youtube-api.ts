const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export interface YouTubeLiveVideo {
  id: { videoId: string };
  snippet: { title: string };
}

export async function getYouTubeLiveVideos(channelKey: string): Promise<YouTubeLiveVideo[]> {
  const handle = channelKey.startsWith('@') ? channelKey : `@${channelKey}`;
  const url = `https://www.youtube.com/${handle}/streams`;

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
  findLiveVideos(data, results);
  return results;
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

function findLiveVideos(obj: unknown, results: YouTubeLiveVideo[]): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (const item of obj) findLiveVideos(item, results);
    return;
  }

  const record = obj as Record<string, unknown>;

  if (typeof record.videoId === 'string' && Array.isArray(record.thumbnailOverlays)) {
    const isLive = record.thumbnailOverlays.some((overlay: unknown) => {
      if (!overlay || typeof overlay !== 'object') return false;
      const tots = (overlay as Record<string, unknown>)
        .thumbnailOverlayTimeStatusRenderer as Record<string, unknown> | undefined;
      return tots?.style === 'LIVE';
    });

    if (isLive) {
      results.push({
        id: { videoId: record.videoId },
        snippet: { title: extractText(record.title) }
      });
      return;
    }
  }

  for (const value of Object.values(record)) {
    findLiveVideos(value, results);
  }
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
