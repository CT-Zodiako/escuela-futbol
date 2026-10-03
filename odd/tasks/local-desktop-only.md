# Local-only desktop cutover

## Goal
Make the Windows Tauri desktop application fully local: SQLite is the only data source, the embedded React frontend is not deployed as web, WhatsApp sharing remains available, and Railway/API infrastructure is retired after local verification.

## Decisions
- Production client: Desktop only.
- `apps/web`: retained as the Tauri-embedded frontend source; no standalone web deployment.
- Persistence: local SQLite, including administrator authentication, trainers, students, payments, reports, and receipt numbering.
- Authentication: first-run administrator setup; no credentials compiled into the installer.
- WhatsApp sharing: preserved because it is a local OS/browser handoff, not a server feature.
- Railway deletion: final destructive operation after the local build and runtime checks pass.

## Tasks
- [x] Design and implement local SQLite schema and first-run administrator setup.
- [x] Move desktop data reads/writes, reports, and authentication off the API.
- [x] Remove sync/network behavior and Railway API configuration from desktop builds.
- [x] Remove standalone web/Railway deployment automation and update documentation.
- [x] Verify desktop build, tests, first-run setup, persistence, reports, and WhatsApp sharing.
- [x] Verify Railway project decommission status after explicit final confirmation.

## Non-goals
- Do not delete the embedded React source in `apps/web`.
- Do not remove the WhatsApp share flow.
- Do not publish a web version.
- Do not destroy remote data before local verification and a final confirmation.

## Evidence
- Local admin tables, PBKDF2 password envelopes, hashed sessions, and Tauri auth commands were added in `apps/desktop/src-tauri/src/sync.rs`.
- Desktop payment updates, student status changes, reports, and CSV export now use local SQLite commands; Rust tests increased to 23 passing.
- Desktop no longer calls network sync or displays sync-pending state; local create operations remain durable and Rust tests now pass 24/24.
- First-run setup is exposed through `apps/web/src/pages/SetupPage.tsx` and the desktop bridge.
- Validation: `cargo test --offline` (17 passed), `npx tsc -b` (passed), and `npx vite build` (passed).
- Existing desktop SQLite tables and local persistence commands are in `apps/desktop/src-tauri/src/sync.rs`.
- Desktop authentication and data operations use Tauri commands; non-desktop HTTP branches remain only for development compatibility.
- Windows CI builds without a Railway API URL.
- Railway IaC and `.railwayignore` were removed; Windows CI no longer injects a Railway API URL.
- After explicit authorization, Railway CLI confirmed project `escuela-futbol` is already marked deleted (`deletedAt` reported by `railway project list --json`); no remote deletion command was needed in this session.
- Local macOS build passed with `pnpm build:desktop --config '{"bundle":{"createUpdaterArtifacts":false}}'`; Tauri produced the macOS application bundle.
