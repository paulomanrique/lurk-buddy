# AGENTS.md

## Project

- Name: `Lurk Buddy`
- License: `Unlicense`
- Product type: Electron desktop app for managing lurk sessions on Twitch, YouTube and Kick
- Branding: black + coral/red visual language derived from the provided Lurk Buddy logo

## Stack

- Electron
- React
- TypeScript
- Vite
- SQLite via `better-sqlite3`
- Zustand
- Zod
- Vitest
- Playwright

## Repo Layout

- `src/main/`: Electron main process, IPC wiring, app bootstrap
- `src/preload/`: preload bridge and page focus/visibility spoofing
- `src/renderer/`: React UI
- `src/shared/`: shared types, constants, IPC contracts, schemas
- `src/modules/`: app services for channels, sessions, polling, settings, logging
- `src/platforms/`: platform adapters
- `src/db/`: SQLite setup and migrations
- `tests/`: unit/e2e scaffolding

## Current Behavior

- Channels are stored locally in SQLite.
- Polling runs in the main process.
- Live sessions are rendered as `WebContentsView` instances inside the main window.
- The renderer sends live area bounds to the main process so the native view aligns with the React layout.
- `Panel Only` must hide the native live view completely.
- Tabs are muted at the Electron container level, not by muting the site player.
- The active live tab can be unmuted by user action through the UI.
- Focus/visibility spoofing is implemented in preload.

## Platform Notes

- Twitch currently has the strongest live detection.
- Twitch detection uses `application/ld+json` data from the channel page and checks `BroadcastEvent.isLiveBroadcast`.
- YouTube and Kick still need equivalent hardening; their detection is currently more heuristic.

## Electron Runtime Notes

- The environment may export `ELECTRON_RUN_AS_NODE=1`. This breaks the app boot by forcing Electron into Node mode.
- `dev` and `start` launch Electron via `scripts/run-electron.mjs`, which `delete`s `ELECTRON_RUN_AS_NODE` from the spawned env. `cross-env VAR=` cannot actually unset a variable — it sets it to empty string, which Electron still treats as "run as node".
- `better-sqlite3` must be rebuilt against Electron’s ABI. `postinstall` runs `npm run rebuild:native` for that reason.
- Vite is pinned to `127.0.0.1:5173` with `strictPort: true` because the Electron dev script waits on that exact address.

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Test: `npm run test`
- Rebuild native modules: `npm run rebuild:native`

## UI Notes

- The main window has two states:
  - management panel
  - active live session
- There must always be a clear way to return to the management panel.
- The native live area must stay visually aligned with the reserved React container.
- Avoid horizontal overflow in sidebar and tracked-channel rows.

## Code Change Rules

- Always validate changes with the smallest relevant command set before finishing.
- Prefer:
  - `npm run build`
  - `npm run test`
- If a change affects Electron startup or native modules, validate `npm run dev` as well.

## Release Rules

- Every release must keep the public site (`docs/index.html`) in sync with the latest version.
- `docs/index.html` is the GitHub Pages site (served from `master` → `/docs`). Its download links and version badges embed the version (e.g. `v0.0.7`) because the artifact names from `electron-builder.yml` include `${version}`.
- The `.github/workflows/update-site.yml` workflow updates those links/badges automatically when a release is published. After publishing a release, confirm that workflow ran green (`gh run list --workflow=update-site.yml`) and that `docs/index.html` actually points at the new tag.
- If the workflow ever fails, manually bump every version reference in `docs/index.html` to the new tag and push, otherwise the site keeps advertising the previous version.

## Git Workflow Rules

- Every code change must be followed by a git commit.
- Every commit must be pushed immediately after it is created.
- Do not batch unrelated code changes into one commit when they can be split into coherent steps.
- Use clear commit messages that describe the actual change.
- Before finishing a task, ensure:
  - `git status --short` is clean
  - local branch is pushed to `origin`
