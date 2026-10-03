# Release 0.2.3 local data reset

## Goal
Publish the next Desktop release with a one-time local SQLite reset so machines with failed sync start cleanly without deleting the remote administrator.

## Tasks
- [x] Add a versioned one-time local data reset for the 0.2.3 release.
- [x] Verify required player fields, trainer normalization, and local reset behavior.
- [ ] Commit, push, tag v0.2.3, and verify the Windows release workflow.

## Acceptance criteria
- Existing local Desktop data tables and outboxes are cleared once on first launch of the 0.2.3 build.
- The reset marker persists so later launches do not repeatedly erase new data.
- The reset does not touch the API/Railway database or the remote administrator.
- A clean app can create trainers and players only with required document and phone fields.
- Release v0.2.3 is published without overwriting v0.2.2.

## Notes
- This is intentionally destructive for local player/trainer/payment data because the user authorized a reset to recover from sync failure.
- A local database backup was already created before the current manual reset at `/tmp/historical.sqlite3.before-reset-20261003152312.bak`.
- Validation: API tests 55/55, Rust tests 13/13, web build, and production-URL Desktop build passed. The known non-blocking Vite chunk warning remains.
