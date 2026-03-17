import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

config({
  path: existsSync(join(process.cwd(), '.env')) ? join(process.cwd(), '.env') : undefined
});

export interface RuntimeEnv {
  twitchClientId: string;
  twitchClientSecret: string;
  youtubeApiKey: string;
  kickClientId: string;
  kickClientSecret: string;
}

export const runtimeEnv: RuntimeEnv = {
  twitchClientId: process.env.TWITCH_CLIENT_ID ?? '',
  twitchClientSecret: process.env.TWITCH_CLIENT_SECRET ?? '',
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? '',
  kickClientId: process.env.KICK_CLIENT_ID ?? '',
  kickClientSecret: process.env.KICK_CLIENT_SECRET ?? ''
};
