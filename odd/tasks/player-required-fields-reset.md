# Required player fields and clean test data

## Goal
Require document and phone for new player registration and reset local/Railway data to run the new flow from an empty state while preserving the administrator.

## Tasks
- [x] Require document and phone in API, web, and offline validation.
- [x] Normalize new trainer names in online/offline creation paths.
- [x] Reset local and Railway data while preserving the administrator.
- [x] Rebuild and relaunch the local Desktop app.

## Acceptance criteria
- New players cannot be registered without document and phone.
- Existing player/trainer/payment data is removed from both selected databases.
- The administrator remains available for login.
- Local app launches against the production API with an empty dataset.

## Evidence
- API tests: 55/55 passed.
- Web and production-URL Desktop builds passed.
- Local SQLite backup: `/tmp/historical.sqlite3.before-reset-20261003152312.bak`.
- Local counts after reset: trainers 0, students 0, payments 0, outboxes 0.
- Railway counts after reset: admins 1, trainers 0, students 0, payments 0, receipt counters 0.
- Desktop process relaunched as PID 52546.
