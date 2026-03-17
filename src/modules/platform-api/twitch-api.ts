import { runtimeEnv } from '../../main/env.js';

interface TwitchToken {
  accessToken: string;
  expiresAt: number;
}

let cachedToken: TwitchToken | null = null;

export interface TwitchStreamResponse {
  data: Array<{
    id: string;
    user_login: string;
    user_name: string;
    game_name: string;
    type: string;
    title: string;
    viewer_count: number;
  }>;
}

export async function getTwitchLiveStream(channelKey: string): Promise<TwitchStreamResponse['data'][number] | null> {
  if (!runtimeEnv.twitchClientId) {
    return null;
  }

  const token = await getTwitchAccessToken();
  if (!token) {
    return null;
  }

  const response = await fetch(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channelKey)}`,
    {
      headers: {
        'Client-Id': runtimeEnv.twitchClientId,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Twitch streams API failed with ${response.status}`);
  }

  const payload = (await response.json()) as TwitchStreamResponse;
  return payload.data.find((stream) => stream.type === 'live') ?? null;
}

async function getTwitchAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  if (!runtimeEnv.twitchClientId || !runtimeEnv.twitchClientSecret) {
    return null;
  }

  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: runtimeEnv.twitchClientId,
      client_secret: runtimeEnv.twitchClientSecret,
      grant_type: 'client_credentials'
    })
  });

  if (!response.ok) {
    throw new Error(`Twitch auth failed with ${response.status}`);
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000
  };
  return cachedToken.accessToken;
}
