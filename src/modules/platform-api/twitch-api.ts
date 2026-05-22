const WEB_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';

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

type TwitchStream = TwitchStreamResponse['data'][number];

export async function getTwitchLiveStream(channelKey: string): Promise<TwitchStream | null> {
  const response = await fetch('https://gql.twitch.tv/gql', {
    method: 'POST',
    headers: {
      'Client-Id': WEB_CLIENT_ID,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      query:
        'query($login: String!) { user(login: $login) { id login displayName stream { id title type viewersCount game { name } } } }',
      variables: { login: channelKey }
    })
  });

  if (!response.ok) {
    throw new Error(`Twitch GQL failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    data?: {
      user?: {
        id?: string;
        login?: string;
        displayName?: string;
        stream?: {
          id: string;
          title: string;
          type: string;
          viewersCount: number;
          game?: { name?: string } | null;
        } | null;
      } | null;
    };
    errors?: Array<{ message: string }>;
  };

  if (payload.errors?.length) {
    throw new Error(`Twitch GQL errors: ${payload.errors.map((e) => e.message).join('; ')}`);
  }

  const user = payload.data?.user;
  const stream = user?.stream;
  if (!stream || stream.type !== 'live') {
    return null;
  }

  return {
    id: stream.id,
    user_login: user?.login ?? channelKey,
    user_name: user?.displayName ?? channelKey,
    game_name: stream.game?.name ?? '',
    type: stream.type,
    title: stream.title,
    viewer_count: stream.viewersCount
  };
}
