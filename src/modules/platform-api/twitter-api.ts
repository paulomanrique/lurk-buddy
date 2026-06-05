import * as electron from 'electron';
import { PLATFORM_PARTITIONS } from '../../shared/constants.js';

// Public web bearer token shipped by x.com's own front-end (not a secret; it is
// the same guest/web token the site sends on every request).
const WEB_BEARER =
  'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// GraphQL operation id for UserByScreenName. X rotates these periodically; if
// user resolution starts failing, refresh this value from a live x.com request.
const USER_BY_SCREEN_NAME_QUERY_ID = 'sLVLhk0bGj3MVFEKTdax1w';

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export interface TwitterLiveBroadcast {
  broadcastId: string;
  title: string | null;
}

// X login-walls its content, so detection reuses the cookies established when the
// user logged into the embedded `persist:twitter` session (via Electron's
// `net.fetch({ session })`). The `x-csrf-token` header must echo the `ct0` cookie.
// When not authenticated the endpoints 401/403; we return null (treated as
// offline) rather than throwing, to avoid noisy poll errors.
//
// NOTE: live *video broadcast* detection is the most fragile part of the app —
// X's GraphQL surface (operation ids, feature flags, response shape) shifts. All
// of that volatility is intentionally quarantined in this module.
export async function getTwitterLiveBroadcast(handle: string): Promise<TwitterLiveBroadcast | null> {
  const screenName = handle.replace(/^@/, '').trim();
  if (!screenName) return null;

  const xSession = electron.session.fromPartition(PLATFORM_PARTITIONS.twitter);
  const csrfToken = await readCookie(xSession, 'https://x.com', 'ct0');
  if (!csrfToken) {
    // No ct0 cookie => not logged in. Nothing to query.
    return null;
  }

  const userResult = await fetchUserByScreenName(xSession, screenName, csrfToken);
  if (!userResult) return null;

  const broadcast = findLiveBroadcast(userResult);
  if (!broadcast) return null;

  return broadcast;
}

async function fetchUserByScreenName(
  xSession: electron.Session,
  screenName: string,
  csrfToken: string
): Promise<unknown> {
  const variables = JSON.stringify({
    screen_name: screenName,
    withSafetyModeUserFields: true
  });
  const features = JSON.stringify({
    hidden_profile_likes_enabled: true,
    hidden_profile_subscriptions_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    subscriptions_verification_info_is_identity_verified_enabled: true,
    subscriptions_verification_info_verified_since_enabled: true,
    highlights_tweets_tab_ui_enabled: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true
  });
  const url =
    `https://x.com/i/api/graphql/${USER_BY_SCREEN_NAME_QUERY_ID}/UserByScreenName` +
    `?variables=${encodeURIComponent(variables)}&features=${encodeURIComponent(features)}`;

  const response = await xSession.fetch(url, {
    headers: xHeaders(csrfToken)
  });

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Twitter UserByScreenName failed with ${response.status}`);
  }

  const payload = (await response.json().catch(() => null)) as
    | { data?: { user?: { result?: unknown } } }
    | null;
  return payload?.data?.user?.result ?? null;
}

function xHeaders(csrfToken: string): Record<string, string> {
  return {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'en-US,en;q=0.9',
    authorization: `Bearer ${WEB_BEARER}`,
    'x-csrf-token': csrfToken,
    'x-twitter-active-user': 'yes',
    'x-twitter-auth-type': 'OAuth2Session',
    'x-twitter-client-language': 'en',
    'content-type': 'application/json',
    Referer: 'https://x.com/'
  };
}

async function readCookie(
  xSession: electron.Session,
  url: string,
  name: string
): Promise<string | null> {
  try {
    const cookies = await xSession.cookies.get({ url, name });
    return cookies[0]?.value ?? null;
  } catch {
    return null;
  }
}

// Recursively search the user result for a currently-running live video
// broadcast. X embeds broadcast metadata under varying keys; we look for a node
// that carries a broadcast/media id together with a running/live state.
function findLiveBroadcast(data: unknown): TwitterLiveBroadcast | null {
  if (!data || typeof data !== 'object') return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findLiveBroadcast(item);
      if (found) return found;
    }
    return null;
  }

  const record = data as Record<string, unknown>;

  const broadcastId =
    pickString(record, 'broadcast_id') ?? pickString(record, 'broadcastId') ?? pickString(record, 'media_key');
  if (broadcastId) {
    const state = (
      pickString(record, 'state') ??
      pickString(record, 'broadcast_state') ??
      pickString(record, 'status') ??
      ''
    ).toLowerCase();
    const isRunning = state === '' || state === 'running' || state === 'live';
    if (isRunning) {
      const title =
        pickString(record, 'status') === broadcastId
          ? null
          : pickString(record, 'title') ?? pickString(record, 'broadcast_title');
      return { broadcastId, title: title ?? null };
    }
  }

  for (const value of Object.values(record)) {
    const found = findLiveBroadcast(value);
    if (found) return found;
  }
  return null;
}

function pickString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number') return String(value);
  return null;
}
