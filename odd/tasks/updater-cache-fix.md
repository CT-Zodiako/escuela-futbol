# Updater cache fix

## Goal
Fix the in-app updater so it reliably detects new Windows releases instead of missing them due to GitHub CDN/redirect caching.

## Context
- User updated from v0.3.8 to v0.3.9 manually because the in-app updater did not detect v0.3.9.
- The current endpoint is `https://github.com/CT-Zodiako/escuela-futbol/releases/latest/download/latest.json?v={{current_version}}`.
- `releases/latest/download/latest.json` performs a 302 redirect to the asset of the latest release; the redirect or final asset may be cached by GitHub's CDN, causing the updater to see stale metadata.

## Proposed fix
1. Change the updater endpoint to a non-redirecting URL: `https://raw.githubusercontent.com/CT-Zodiako/escuela-futbol/release/v0.3.0-local-only/latest.json`.
2. Update the Windows release workflow to commit/push `latest.json` to the repository root on the `release/v0.3.0-local-only` branch after each release.
3. Improve error visibility in the update UI so future failures are not silently swallowed.

## Tasks
- [ ] Update `tauri.conf.json` updater endpoint to use raw.githubusercontent.com.
- [ ] Update `.github/workflows/build-windows.yml` to commit `latest.json` to the release branch.
- [ ] Improve `UpdatePanel.tsx` error reporting for `check()` failures.
- [ ] Verify local macOS build still compiles.
- [ ] Publish v0.3.10 and test that v0.3.9 detects it in-app.

## Constraints
- Preserve local data and existing update flow.
- Keep the Windows workflow signing and asset upload unchanged.
- Do not break manual installer fallback.
