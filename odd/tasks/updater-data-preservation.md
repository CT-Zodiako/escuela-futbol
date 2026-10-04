# Updater data preservation

## Goal
Make Windows in-app and installer updates preserve the local SQLite database and ensure the updated binary is relaunched.

## Tasks
- [x] Add an external backup/restore guard for the local database and improve updater restart behavior.
- [ ] Verify the desktop build and document a non-destructive Windows update test.

## Constraints
- Never delete or migrate the user's local data as part of update handling.
- Keep the Mac build development-only; Windows release remains the production target.

## Implementation notes (2026-02)

Context: the internal updater never advanced beyond v0.3.1 and the manual
installer only appeared to work after uninstalling and deleting data, so the
fix prioritizes data preservation.

- `sync.rs` adds `backup_local_data` (registered in `lib.rs`, exposed as
  `desktop.backupLocalData()` in `apps/web/src/api/desktop.ts`). It copies
  `historical.sqlite3` to a sibling directory of the app-data folder named
  `<app-data-dir>-backup` (for example `Roaming/com.escuelafutbol.desktop-backup`
  next to `Roaming/com.escuelafutbol.desktop`), using the stable filename
  `historical.sqlite3.backup`. The directory is created on demand and the copy
  goes through a temporary file plus rename so a crash never leaves a
  truncated backup. Before copying, a SQLite connection runs
  `PRAGMA wal_checkpoint(TRUNCATE)` so the byte-for-byte copy is consistent.
  Failures return a safe Spanish user-facing error; when the database is
  missing the command is a no-op so an existing backup is never erased.
- `open()` now restores the backup before initializing: if the expected
  database is missing and the external backup exists, the backup is copied
  back into place. A database that already exists on disk — even an empty
  file — is never overwritten by the backup. Restore uses the same
  temp-plus-rename atomic copy.
- `UpdatePanel.tsx` calls `desktop.backupLocalData()` before
  `downloadAndInstall` when running in Tauri; if the backup fails the install
  aborts with a clear message protecting the user's data. After a successful
  install it decides how to finish based on the platform, detected in the
  frontend from the user agent (no API changes):
  - Windows (NSIS): it does **not** call `relaunch()` automatically. The
    installer can still be replacing files when the app exits, and an
    immediate relaunch can start the old binary — this is the diagnosed
    cause of the v0.3.3 symptom (update detected and installed, but after
    the automatic restart the app still reported v0.3.1). Instead the panel
    tells the user to close the app completely, wait for the installer to
    finish, and reopen it manually. The manual "Reiniciar aplicación"
    button remains only as an explicit fallback.
  - macOS/Linux (development): automatic `relaunch()` is kept because it
    remains safe there; if it fails, the manual-restart button and message
    are the fallback. The pre-install copy explains the restart behavior.
- Focused Rust tests cover the backup round trip, sibling-directory placement,
  no partial temp files, restore-only-when-missing, never-overwrite-live-data,
  and a real SQLite database surviving backup + restore.

## Root cause and fix note (2026-02, data loss during updates)

The confirmed cause of user data loss during updates was not the installer
itself but a destructive legacy migration in `apps/desktop/src-tauri/src/sync.rs`:
the v0.2.3 "one-time reset" (`apply_one_time_resets`) deleted payments,
students, trainers, all outboxes, and sync state whenever the migration marker
`reset-local-data-v0.2.3` was absent from `migration_markers`. Any update path
that handed the app a database without that marker — including the Windows
update flow — silently wiped local data on first launch.

Fix: the reset is replaced by `acknowledge_legacy_reset_marker`. When the
marker is absent it now only inserts the marker (name kept for compatibility)
and preserves every existing table and row. The focused test
`second_admin_is_rejected_and_local_data_survives_initialize` asserts that
pre-existing students, payments, trainers, outboxes, sync state, the receipt
counter, and admin/session data all survive `initialize`, while the second-admin
rejection and session behavior remain correct.

## Root cause and fix note (stale frontend cache, v0.3.5 binary showing v0.3.1 UI)

Confirmed by user screenshot: the Windows executable file properties report
v0.3.5 while the in-app header still renders v0.3.1 and the updater reports
"latest". This is not an updater/versioning problem — the packaged frontend
was current; the visible UI came from stale cached assets.

Cause: `apps/web/vite.config.ts` enabled `vite-plugin-pwa` unconditionally, so
every desktop build (Tauri `beforeBuildCommand` runs `pnpm --dir ../web build`)
shipped `sw.js` + Workbox precache into WebView2. A previously registered
service worker kept serving the old precached HTML/JS after updates, masking
the new packaged assets.

Fix:
- `apps/web/vite.config.ts`: the PWA plugin is now disabled during Tauri
  builds. Tauri injects `TAURI_ENV_PLATFORM` into `beforeBuildCommand`/
  `beforeDevCommand`; when it is present, `VitePWA({ disable: true })`
  generates no service worker, workbox, register script, or manifest.
  Ordinary web dev/build (no Tauri env) keeps the previous PWA behavior.
  Note: vite-plugin-pwa 0.20.5 names this option `disable` (top level),
  not `disabled` (that name belongs to the pwaAssets sub-options).
- `apps/web/src/main.tsx`: on startup inside Tauri (`isDesktop` from
  `api/desktop.ts`), unregister all service worker registrations and delete
  all Cache Storage entries (feature-detected, best-effort try/catch). If
  anything was removed, reload exactly once — guarded by a sessionStorage
  flag (`escuela-sw-cache-cleared`) so a reload loop is impossible — so the
  packaged frontend loads fresh assets. Browsers (non-Tauri) are untouched.

Do not touch updater/data or report/student logic; this fix is frontend
asset-delivery only.

## Root cause and fix note (stale frontend cache persists, v0.3.6 binary showing v0.3.1 UI)

Confirmed by user screenshot: the installed Windows exe reports v0.3.6 while
the in-app header still renders v0.3.1. The v0.3.5 fix removed the service
worker from *new* builds, but machines that already registered the old
service worker were not healed: the previous `main.tsx` cleanup runs in the
renderer, i.e. *after* the webview has already loaded — and the old service
worker intercepts that first load and serves the old precached HTML/JS
before any cleanup can execute.

Fix (native layer, `apps/desktop/src-tauri/src/lib.rs`):
- `run()` now installs a Tauri `.setup()` hook, which runs before the main
  webview loads. It calls `clear_stale_frontend_cache_once()`, which uses
  the main `WebviewWindow` and `clear_all_browsing_data()` exactly once to
  wipe the stale service worker/cache held by WebView2.
- The clear is guarded by a marker file, `frontend-cache-cleared-v0.3.7`,
  written under `app.path().app_data_dir()` (created on demand), so WebView
  storage is not wiped on every launch. The SQLite database files live in
  the same directory and are never touched or deleted.
- If the main webview window is unavailable, setup fails with a clear error
  instead of silently skipping the migration or inventing another path.

The frontend `main.tsx` cleanup is kept as defense in depth for browsers and
edge cases; the native clear is the authoritative fix for installed desktop
releases that shipped the stale PWA cache.

## Non-destructive Windows update test (pending)

1. Install the current release and record students/payments.
2. Trigger the in-app update and confirm: backup file appears under
   `%APPDATA%\com.escuelafutbol.desktop-backup\historical.sqlite3.backup`
   and all data is intact. On Windows the panel must **not** relaunch
   automatically; it must instruct the user to close the app completely,
   wait for the NSIS installer to finish, and reopen the app manually.
   After the manual reopen the reported version must be the new one
   (regression check for the v0.3.3 bug where the old binary relaunched
   and still showed v0.3.1).
3. macOS/Linux: confirm the app still relaunches automatically after
   install and reports the new version.
4. Uninstall/reinstall scenario: with data present, run the manual installer
   without deleting anything and confirm the app restores from the external
   backup if the app-data folder was wiped.
