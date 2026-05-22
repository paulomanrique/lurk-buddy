import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function resolveEnvPath(): string | undefined {
  // Packaged app: .env is placed in resources/ via extraResources
  if (process.resourcesPath) {
    const p = join(process.resourcesPath, '.env');
    if (existsSync(p)) return p;
  }
  // Development: .env at project root
  const p = join(process.cwd(), '.env');
  if (existsSync(p)) return p;
  return undefined;
}

config({ path: resolveEnvPath() });

export interface RuntimeEnv {
  kickClientId: string;
  kickClientSecret: string;
}

export const runtimeEnv: RuntimeEnv = {
  kickClientId: process.env.KICK_CLIENT_ID ?? '',
  kickClientSecret: process.env.KICK_CLIENT_SECRET ?? ''
};
