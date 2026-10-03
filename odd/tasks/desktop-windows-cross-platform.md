# Cross-platform desktop build (Windows x64 + macOS)

> **Superseded:** the Windows build no longer injects a hosted API URL; the desktop bundle is
> fully self-contained and local. See the "Local-only desktop cutover" record.

## Goal
Produce a distributable Windows x64 installer while preserving the existing macOS development/build path.

## Scope
- Configure Tauri bundling for Windows NSIS and macOS app output.
- Add a reproducible GitHub Actions Windows build using the production API URL.
- Document Windows installation prerequisites and artifact location.
- Keep the existing macOS developer workflow intact.

## Tasks
- [x] Configure platform bundle targets and Windows installer metadata.
- [x] Add Windows x64 CI build artifact workflow.
- [x] Document Windows and macOS build/install paths.
- [x] Verify configuration JSON and workflow YAML with lightweight static checks.
- [ ] Verify Windows installer output and installation through CI/manual testing.
- [ ] Verify web and macOS builds (not run: this task permits lightweight static checks only).

## Acceptance criteria
- Windows x64 build produces an `.exe` installer artifact.
- macOS `pnpm build:desktop` continues to produce the `.app` bundle.
- Windows build used `https://api-production-28e26.up.railway.app` at the time (later removed; builds are self-contained local bundles).
- Existing offline SQLite behavior remains unchanged.

## Implementation and validation

- Preserve the default `app` bundle target for macOS; Windows CI explicitly selects `--bundles nsis` and `x86_64-pc-windows-msvc`.
- Configure a current-user Spanish NSIS installer and automatic WebView2 bootstrapper download when missing.
- Use the production API URL in CI and fail artifact upload if no installer exists.
- `git diff --check` passed.
- Node.js parsed the Tauri JSON and verified the app target, current-user installer, and WebView2 download mode.
- Ruby parsed the workflow YAML and verified the Windows runner.
- Native builds, installer execution, and application tests were not run. Static checks do not prove successful native packaging.
- No application behavior or SQLite source was changed. No commit was created.

## Non-goals
- Code signing or notarization.
- Offline writes/outbox.
- Replacing the Mac development machine.
