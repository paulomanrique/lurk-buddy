const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export interface TikTokLiveInfo {
  roomId: string;
  nickname: string | null;
}

// TikTok exposes a non-empty `roomId` on the public profile page when the user
// is currently broadcasting; the field is `""` otherwise. The `/live` URL is
// captcha-walled, but the profile page itself returns the rehydration JSON
// reliably without auth.
export async function getTikTokLiveInfo(handle: string): Promise<TikTokLiveInfo | null> {
  const trimmed = handle.replace(/^@/, '');
  const response = await fetch(`https://www.tiktok.com/@${trimmed}`, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) {
    throw new Error(`TikTok profile fetch failed with ${response.status}`);
  }

  const html = await response.text();
  const data = extractRehydrationData(html);
  if (!data) return null;

  const user = findUserNode(data);
  const roomId = typeof user?.roomId === 'string' ? user.roomId : '';
  if (!roomId) return null;

  const nickname = typeof user?.nickname === 'string' ? user.nickname : null;
  return { roomId, nickname };
}

function extractRehydrationData(html: string): unknown {
  const match = html.match(
    /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as unknown;
  } catch {
    return null;
  }
}

interface TikTokUserNode {
  roomId?: unknown;
  nickname?: unknown;
}

function findUserNode(data: unknown): TikTokUserNode | null {
  if (!data || typeof data !== 'object') return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findUserNode(item);
      if (found) return found;
    }
    return null;
  }

  const record = data as Record<string, unknown>;
  if ('roomId' in record && ('nickname' in record || 'uniqueId' in record)) {
    return record as TikTokUserNode;
  }

  for (const value of Object.values(record)) {
    const found = findUserNode(value);
    if (found) return found;
  }
  return null;
}
