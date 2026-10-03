# Windows updater restart safety

## Goal
Prevent the Windows updater from reopening the old application process after a successful update.

## Tasks
- [x] Stop automatic relaunch immediately after download/install.
- [x] Tell the user to close and reopen the desktop app manually after installation.
- [x] Run frontend/desktop checks and record the outcome.

## Acceptance criteria
- A successful update does not call relaunch automatically.
- The UI clearly instructs the user to close and reopen the app.
- Local application data is not deleted or reset.

## Notes
- The user observed v0.2.0 reopening after an automatic v0.2.1 update.
- Release metadata and assets are correct; this change targets the suspected relaunch race.
- Validation: `pnpm build:web` and `VITE_API_URL=https://api-production-28e26.up.railway.app pnpm build:desktop` passed. Windows runtime testing remains pending.
- Delivery: not committed yet; requires a new release after Windows validation.
