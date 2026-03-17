import { runtimeEnv } from '../../main/env.js';

type KickApiPayload = Record<string, unknown>;
interface KickToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: KickToken | null = null;

export async function getKickChannelStatus(channelKey: string): Promise<KickApiPayload | null> {
  const token = await getKickAccessToken();
  if (!token) {
    return null;
  }

  const response = await fetch(
    `https://api.kick.com/public/v1/channels?slug=${encodeURIComponent(channelKey)}`,
    {
      headers: {
        accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36'
      }
    }
  );

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Kick API failed with ${response.status}`);
  }

  return (await response.json()) as KickApiPayload;
}

export function extractKickLiveStatus(payload: KickApiPayload | null): boolean {
  if (!payload) {
    return false;
  }
  const data = Array.isArray(payload.data) ? payload.data[0] : payload.data;
  if (!data || typeof data !== 'object') {
    return false;
  }
  const record = data as Record<string, unknown>;
  const stream = record.stream;
  return Boolean(
    record.is_live === true ||
      record.isLive === true ||
      (stream && typeof stream === 'object' && (stream as Record<string, unknown>).is_live === true)
  );
}

async function getKickAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  if (!runtimeEnv.kickClientId || !runtimeEnv.kickClientSecret) {
    return null;
  }

  const response = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: runtimeEnv.kickClientId,
      client_secret: runtimeEnv.kickClientSecret
    })
  });

  if (!response.ok) {
    throw new Error(`Kick auth failed with ${response.status}`);
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000
  };
  return cachedToken.accessToken;
}
