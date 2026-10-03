# Offline SQLite historical read mirror

> **Superseded:** this snapshot/sync slice targeted the hosted Railway API. The desktop product
> is now fully local (SQLite is the sole store) and no snapshot download, Railway deployment, or
> `VITE_API_URL` build step applies. Preserved as the historical record of this slice.

## Goal
Allow the macOS Tauri app to download a complete student/payment snapshot and consult it without internet, while preserving browser/PWA online behavior.

## Scope
- Add an authenticated full snapshot endpoint.
- Store students and payments in a local SQLite mirror through Tauri commands.
- Read student lists and payment histories from SQLite in the desktop app.
- Provide explicit refresh and last-synchronized status.
- Preserve the last complete snapshot when refresh fails.
- No offline mutations, outbox, conflict resolution, or offline reports in this slice.

## Tasks
- [x] Add full authenticated sync snapshot contract and endpoint.
- [x] Add Tauri SQLite storage and commands for snapshot/read/status.
- [x] Add desktop-only transport selection and refresh/status UI.
- [ ] Verify online browser behavior and offline desktop historical reads.

## Acceptance criteria
- A desktop user can download all students and payments while online.
- After closing/reopening and losing internet, the desktop app can list students and open complete payment histories from SQLite.
- A failed refresh does not erase the previous local snapshot.
- Browser/PWA continues using HTTP and is unchanged.
- No offline write controls are presented in this slice.

## Non-goals
- Offline payment/student creation or edits.
- Automatic conflict resolution.
- Offline reports/CSV parity.
- Cloud backup/restore.

## Evidence
- Source implementation added; installation, tests, builds, and runtime verification deferred to the parent by explicit instruction. No generated outputs were written.
- API: authenticated `GET /api/sync/snapshot`, PostgreSQL repeatable-read transaction, all students (including inactive) and payments, `generatedAt`, and `Cache-Control: no-store`.
- Desktop: bundled rusqlite database `historical.sqlite3` in Tauri app data. Typed commands initialize storage, atomically replace the mirror, list students/payments, and read sync status. Foreign keys and primary keys reject orphan/duplicate records; transaction rollback preserves the previous mirror and timestamp.
- Web: Tauri-only local list/history reads; explicit refresh and last-sync/network/error status; refresh after successful login. Existing saved-token authentication allows reopening offline. Logout still requires a new online login. Local data is retained on logout and is not encrypted.
- Desktop is intentionally read-only in this phase: student/payment mutation controls are hidden and API mutations are rejected defensively. Browser writes and HTTP reads remain unchanged. Reports remain HTTP-only. Receipt generation is unchanged.
- Added unexecuted API tests for authentication, unfiltered snapshot contents, isolation, empty data, and failed reads. Added unexecuted Rust tests for duplicate/orphan rollback, receipt/concept preservation, and empty replacement.
- `git diff --check` passed after implementation (tracked changes); no test/build success is claimed.

## Parent validation handoff
- Run `pnpm install --frozen-lockfile`.
- Run `pnpm test:api`, `pnpm build:api`, and `pnpm build:web`.
- Run `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`.
- (Historical, superseded) Run `VITE_API_URL=https://api-production-28e26.up.railway.app pnpm build:desktop`.
- Cargo.lock needs regeneration for rusqlite and its bundled SQLite dependencies; left untouched because generated outputs were prohibited. pnpm dependencies were not changed.
- (Historical, superseded) Deploy the snapshot endpoint before testing refresh against Railway. Verify login/download, close/reopen offline with a saved session, full inactive-student/payment histories, failed refresh retaining data, and browser HTTP behavior. Source tests do not establish these runtime results.
