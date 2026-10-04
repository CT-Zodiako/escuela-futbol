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
