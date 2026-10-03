# In-app desktop updater

## Goal
Allow the official Windows Desktop app to check for and install signed updates from inside the application without manual installer downloads.

## Scope
- Add Tauri updater plugin and permissions.
- Generate and protect a signing key; embed only the public key in the app.
- Build signed updater artifacts in GitHub Actions and publish them with releases.
- Add Desktop update check/download/install UI.
- Preserve macOS development/build support.

## Tasks
- [x] Configure signed Tauri updater and capabilities (implementation; validation pending).
- [x] Add update check/install UI and user feedback (implementation; validation pending).
- [x] Update Windows release workflow with signed artifacts and metadata (implementation; validation pending).
- [ ] Parent regenerates pnpm and Cargo lockfiles and validates frontend/Rust builds.
- [ ] Parent configures GitHub signing secret and verifies release artifacts.
- [ ] Manually bootstrap the first updater-enabled release over v0.1.2.
- [ ] Verify an in-app upgrade between two updater-enabled versions on Windows.

## Acceptance criteria
- App can check for an update without leaving Desktop.
- Only signed artifacts from the configured release endpoint are accepted.
- User can download and install an available update from the app.
- Existing SQLite data remains in the app data directory across updates.
- Malformed update metadata is rejected; downloaded artifacts with missing/invalid signatures are not installed. The JSON manifest itself is not cryptographically signed.

## Implementation notes
- Public key only is embedded; the private key is never read by implementation work or committed.
- Release endpoint: `https://github.com/CT-Zodiako/escuela-futbol/releases/latest/download/latest.json`.
- Stable `vMAJOR.MINOR.PATCH` tags newer than v0.1.2 set the bundled version. Windows x64 is the only published updater platform.
- Base configuration enables updater artifacts; tagged CI uses `v1Compatible` to emit signed `.nsis.zip` artifacts required by this task. Tauri v2 otherwise signs the NSIS executable directly.
- CI publishes installer, archive, signature, and manifest through a draft release, then promotes it to latest. Non-tag test installers do not require secrets.
- Updater signatures do not replace Authenticode signing or eliminate SmartScreen warnings.
- SQLite code, application identifier, and application-data paths are unchanged. Installation must preserve existing local data and pending mutations.
- macOS development remains supported without published macOS updater artifacts.

## Validation handoff
Implementation only: no dependency installation, lockfile regeneration, build, or runtime update test was run by the implementation writer. Strict TDD was not activated.

Parent validation checklist:
- [ ] Resolve dependencies and regenerate both tracked lockfiles.
- [ ] Build TypeScript/frontend and Rust; validate workflow syntax and generated NSIS artifact paths.
- [ ] Check no-update, offline/failing endpoint, available version, cancellation, progress, and restart/error states.
- [ ] Ensure clicking **Ahora no** performs no download or installation.
- [ ] Reject a modified archive or invalid signature without installing it.
- [ ] Confirm latest.json version, `windows-x86_64` URL, and signature match the uploaded archive.
- [ ] Upgrade between two signed releases and confirm SQLite records and pending synchronization survive.
- [ ] Confirm manual CI still produces the installer artifact without signing secrets.
- [ ] Build macOS using the documented local unsigned-artifact override.

## Non-goals
- Silent background installation without user confirmation.
- Automatic database destructive migrations.
- Public web deployment.
