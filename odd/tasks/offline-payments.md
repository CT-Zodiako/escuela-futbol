# Offline and online payments

## Goal
Allow the desktop app to record payments while online or offline, then assign a globally unique consecutive receipt number when the payment reaches the PostgreSQL source of truth.

## Scope
- Add an idempotent payment-sync API that accepts locally created payment mutations.
- Generate the definitive global receipt consecutive on the server.
- Persist a durable desktop outbox in SQLite and retry it when connectivity returns.
- Show pending/synced state in the desktop payment/history UI.
- Keep browser online payment behavior working.

## Tasks
- [x] Implement server-side idempotent payment creation and global receipt assignment (validation pending).
- [x] Implement SQLite outbox and Tauri commands for enqueue/list/mark-synced (validation pending).
- [x] Implement desktop payment creation and retry synchronization (validation pending).
- [ ] Verify online, offline, retry, idempotency, and browser behavior.

## Acceptance criteria
- A desktop user can create a payment with no internet.
- The local payment remains visible immediately with a pending status.
- Reconnection sends it exactly once and receives a global consecutive receipt number.
- Retrying the same local mutation never creates a duplicate payment.
- Existing browser online payment creation remains functional.

## Non-goals
- Offline student creation or editing.
- Multi-device conflict UI beyond server idempotency and receipt assignment.
- Offline reports.

## Implementation evidence
- `POST /api/payments` accepts an optional client mutation UUID; a unique database index protects it. Replays return the original payment with HTTP 200; first creation returns HTTP 201.
- A singleton PostgreSQL counter is initialized above existing receipts while holding an exclusive payments-table lock. Each creation locks that counter row before deduplication and allocation, inside an explicit read-committed transaction. Failed inserts roll back allocation. Legacy client receipt numbers are accepted but never used as the canonical number. Existing receipts remain unchanged.
- SQLite gains a separate durable `payment_outbox` table without replacing historical tables. Enqueue is UUID-idempotent; pending entries are merged into history immediately. Acknowledgements update the same entry atomically. Snapshot replacement cannot discard pending or recently acknowledged payments; snapshot copies are deduplicated and current server payloads take precedence after acknowledgement.
- Desktop creates the UUID before persistence, then attempts delivery. Retries run on dashboard mount, connectivity restoration, every 30 seconds, and manual snapshot refresh. Requests time out after 15 seconds. Failed requests/acknowledgements leave entries pending with the same UUID. This is at-least-once transport with exactly-once server creation, not literally one network request.
- Desktop payment buttons are enabled; other mutation guards remain. History shows pending status or the assigned receipt, and receipt generation is disabled while pending. Browser payment creation remains online and no longer asks users to choose a canonical receipt number.

## Validation evidence and handoff
- Strict TDD was not activated; no RED/GREEN lifecycle claimed.
- Implementation-only authorization: tests, builds, Prisma generation, and migrations were **not run**. The parent owns executable validation and deployment.
- `git diff --check`: passed during implementation (tracked files).
- Added API tests in `apps/api/src/payments.test.ts` covering authorization, ignored legacy receipt numbers, UUID replay, input rejection, missing students, and transaction failure propagation. Updated `validation.test.ts` for optional receipt numbers and mutation/date validation.
- Added Rust tests in `sync.rs` covering immediate visibility, repeated enqueue, additive initialization, snapshot preservation, lost acknowledgements, deduplication, canonical snapshot preference, invalid acknowledgements, and invalid local data. These tests are authored, not execution evidence.

### Parent verification checklist
- [ ] Generate the Prisma client for the changed schema and apply the new migration in a disposable PostgreSQL database containing existing numbered receipts.
- [ ] Run focused API payment/validation tests and Rust `sync::tests`; build/typecheck API and web.
- [ ] Exercise concurrent browser/desktop writes and concurrent identical UUID retries against real PostgreSQL; mocked API tests do not prove database locking or rollback.
- [ ] Record a payment offline, restart Desktop, inspect pending history, reconnect, and verify exactly one server row and one local history row with the canonical number.
- [ ] Simulate a lost response and expired authentication; verify retention and eventual retry after login.
- [ ] Check browser create/edit/receipt workflows and that Desktop student/edit mutations remain disabled.

### Remaining limitations
- `apps/web/src/api/SyncPanel.tsx` now explains that offline payments are queued and synchronized when connectivity returns.
- Acknowledged outbox records are retained as protection against stale snapshots; pruning is not implemented.
- Permanently rejected entries remain pending with a synchronization error; unrelated entries are still attempted. There is no discard/conflict-resolution UI in this phase.
- Deploy migration and regenerated API together with old API writers stopped; legacy writers do not participate in the new counter lock.
- No commit was created.
