# Lurk Buddy

Lurk Buddy is an Electron desktop app for automated lurks on Twitch, YouTube and Kick. It keeps a local registry of channels, polls them on an interval, opens live sessions in managed tabs, keeps page audio logically enabled while muting the Electron tab, and spoofs focus and visibility from preload.

## Stack

- Electron
- React + TypeScript + Vite
- SQLite via `better-sqlite3`
- Zustand
- Zod
- Vitest + Playwright

## Current Scope

- Local channel registry with platform normalization
- Persistent SQLite settings and event logs
- Polling orchestration with per-channel intervals
- Managed live sessions in Electron `WebContentsView`
- Preload focus/visibility spoof
- Coral/black brand shell for the Lurk Buddy control room

## Scripts

```bash
npm install
npm run dev
npm run build
npm run test
```

## Environment

Create `.env` from `.env.example` and fill the API credentials.

- Twitch:
  - `TWITCH_CLIENT_ID`
  - `TWITCH_CLIENT_SECRET`
  - optional `TWITCH_APP_ACCESS_TOKEN`
- Kick:
  - `KICK_CHANNEL_STATUS_URL_TEMPLATE` with `{channel}`
  - or `KICK_API_BASE_URL` so the app requests `/channels/{channel}`
  - optional auth headers: `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`, `KICK_BEARER_TOKEN`

If Electron reports a native module ABI mismatch for `better-sqlite3`, run:

```bash
npm run rebuild:native
```

## Notes

- Sessions are persisted per platform with Electron partitions.
- Login flows are manual inside the embedded platform views.
- Platform live detection is currently heuristic and should be hardened per platform before production use.

## License

Unlicense. See `UNLICENSE`.
