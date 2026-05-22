## Highlights

- **Channel checks are now ~10x faster.** Polling runs five channels in parallel with smarter retry/timeout handling, so the round trip across your full registry finishes in a fraction of the time it used to.
- **TikTok support.** Add a TikTok handle or URL the same way you add any other channel — the app detects when the streamer goes live and opens a tab automatically.

## Other improvements

- Switched Twitch detection to the public web client so the app no longer needs Twitch API credentials.
- Fixed YouTube live detection after YouTube redesigned the `/streams` page; UC channel IDs are now auto-resolved to their `@handle` form to prevent duplicate registrations.
- Added an in-app logs view (the `[logs]` button next to refresh) for quick troubleshooting.
- Various stability fixes around shutdown, live-tab loading, and Electron postinstall.
