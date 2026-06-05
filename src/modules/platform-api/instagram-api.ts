import * as electron from 'electron';
import { PLATFORM_PARTITIONS } from '../../shared/constants.js';

// Public Instagram web app id used by instagram.com's own front-end requests.
const IG_WEB_APP_ID = '936619743392459';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export interface InstagramLiveInfo {
  broadcastId: string;
  nickname: string | null;
}

// Instagram login-walls its content, so detection relies on the cookies the user
// established by logging into the embedded `persist:instagram` session. We reuse
// that cookie jar via Electron's `net.fetch({ session })`. When the user is not
// logged in (or cookies expired) the endpoints 401/redirect; we treat that as
// "offline" and return null rather than throwing, to avoid noisy poll errors.
export async function getInstagramLiveInfo(handle: string): Promise<InstagramLiveInfo | null> {
  const username = handle.replace(/^@/, '').trim();
  if (!username) return null;

  const igSession = electron.session.fromPartition(PLATFORM_PARTITIONS.instagram);
  const csrfToken = await readCookie(igSession, 'https://www.instagram.com', 'csrftoken');

  const profile = await fetchProfile(igSession, username, csrfToken);
  if (!profile) return null;

  const nickname = profile.fullName ?? null;

  // Some responses surface the live broadcast inline on the user node.
  const inlineBroadcast = findBroadcastId(profile.userNode);
  if (inlineBroadcast) {
    return { broadcastId: inlineBroadcast, nickname };
  }

  // Otherwise consult the user's story/reel feed, which carries a `broadcast`
  // node while the account is actively broadcasting.
  if (profile.userId) {
    const storyBroadcast = await fetchStoryBroadcast(igSession, profile.userId, csrfToken);
    if (storyBroadcast) {
      return { broadcastId: storyBroadcast, nickname };
    }
  }

  return null;
}

interface InstagramProfile {
  userId: string | null;
  fullName: string | null;
  userNode: unknown;
}

async function fetchProfile(
  igSession: electron.Session,
  username: string,
  csrfToken: string | null
): Promise<InstagramProfile | null> {
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
  const response = await igSession.fetch(url, {
    headers: igHeaders(csrfToken)
  });

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Instagram profile fetch failed with ${response.status}`);
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: { user?: Record<string, unknown> } }
    | null;
  const userNode = payload?.data?.user;
  if (!userNode || typeof userNode !== 'object') {
    return null;
  }

  const record = userNode as Record<string, unknown>;
  return {
    userId: typeof record.id === 'string' ? record.id : null,
    fullName: typeof record.full_name === 'string' && record.full_name ? record.full_name : null,
    userNode
  };
}

async function fetchStoryBroadcast(
  igSession: electron.Session,
  userId: string,
  csrfToken: string | null
): Promise<string | null> {
  const url = `https://i.instagram.com/api/v1/feed/user/${encodeURIComponent(userId)}/story/`;
  const response = await igSession.fetch(url, {
    headers: igHeaders(csrfToken)
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  return findBroadcastId(payload);
}

function igHeaders(csrfToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'en-US,en;q=0.9',
    'X-IG-App-ID': IG_WEB_APP_ID,
    'X-Requested-With': 'XMLHttpRequest',
    Referer: 'https://www.instagram.com/'
  };
  if (csrfToken) {
    headers['X-CSRFToken'] = csrfToken;
  }
  return headers;
}

async function readCookie(
  igSession: electron.Session,
  url: string,
  name: string
): Promise<string | null> {
  try {
    const cookies = await igSession.cookies.get({ url, name });
    return cookies[0]?.value ?? null;
  } catch {
    return null;
  }
}

// Recursively walk the JSON looking for an active live `broadcast` node and
// return its id. Mirrors the defensive walker pattern in tiktok-api.ts.
function findBroadcastId(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findBroadcastId(item);
      if (found) return found;
    }
    return null;
  }

  const record = data as Record<string, unknown>;

  // A live broadcast node carries an id plus broadcast-specific fields.
  const looksLikeBroadcast =
    ('dash_playback_url' in record || 'dash_abr_playback_url' in record || 'broadcast_status' in record) &&
    ('id' in record || 'broadcast_id' in record);
  if (looksLikeBroadcast) {
    const status = record.broadcast_status;
    if (status === undefined || status === 'active') {
      const id = record.broadcast_id ?? record.id;
      if (typeof id === 'string' && id) return id;
      if (typeof id === 'number') return String(id);
    }
  }

  // Direct inline field on a user node (web_profile_info sometimes includes it).
  if (typeof record.live_broadcast_id === 'string' && record.live_broadcast_id) {
    return record.live_broadcast_id;
  }

  for (const value of Object.values(record)) {
    const found = findBroadcastId(value);
    if (found) return found;
  }
  return null;
}
