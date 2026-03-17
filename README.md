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
