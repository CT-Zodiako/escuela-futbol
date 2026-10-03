# Trainer management and student assignment

## Goal
Let the single production Desktop manage trainers and require selecting one when registering each new student.

## Scope
- Add cloud Trainer model and authenticated trainer list/create endpoints.
- Mirror trainers in SQLite and support offline trainer creation with idempotent synchronization.
- Add Desktop "Registrar entrenador" action and trainer selector in student registration.
- Preserve existing students with nullable trainer assignment until they are edited/migrated.

## Tasks
- [x] Add Trainer persistence, API, and additive migrations.
- [x] Add SQLite trainer mirror/outbox and synchronization.
- [x] Add trainer registration dialog and required student selector.
- [x] Add focused API/Rust test coverage (not executed).
- [ ] Parent: generate Prisma client and run API/Rust tests and frontend/API builds.
- [ ] Parent: verify offline trainer → student → payment creation and reconnect on Windows.

## Acceptance criteria
- A trainer can be registered online or offline.
- A new student cannot be saved without selecting a trainer.
- Newly registered trainers immediately appear in the student selector.
- Existing students and payment history remain readable.
- Retries do not duplicate trainers or students.

## Implementation notes
- Trainer UUIDs are retained as server IDs; unique mutation IDs arbitrate retries and concurrent POSTs.
- Student assignment remains nullable in PostgreSQL and historical SQLite payloads. New API submissions and local enqueues require an existing trainer.
- SQLite adds trainer tables without clearing existing queues. Trainer snapshots are upserted and acknowledged outbox rows remain available across stale snapshots.
- The embedded frontend fetches `/api/trainers` alongside the existing snapshot endpoint, then submits the combined snapshot to SQLite. The server snapshot route is unchanged because it is outside the authorized edit surface.
- Retry orchestration attempts trainers before students and payments. Failed entries remain queued; unrelated records can still synchronize.
- Trainer creation is a separate dashboard action. Opening the student dialog, trainer creation, and Desktop sync events refresh its selector.
- Browser creation still uses authenticated HTTP; Desktop uses durable local creation. Trainer edit/delete and packaging are unchanged.

## Validation handoff and risks
- Implementation-only authorization: no tests, builds, Prisma generation, migrations, or deployment were run.
- API tests cover trainer authentication/list/create, UUID replay/concurrent conflicts, and required/existing student assignment. Rust tests cover trainer queue replay, snapshot bridging, acknowledgement mismatch, required assignment, and historical payment preservation.
- Existing unsynchronized student entries created before this feature may lack a trainer. They are preserved, but the mandatory POST contract rejects them until an explicit assignment recovery policy is provided. No implicit trainer is assigned.
- Parent should remove the unused `20260309120000_trainers` reserved/no-op migration before delivery if desired; actual DDL is in `20261004000000_trainers`, after the existing initial/student migrations. The writer cannot perform deletion operations.
- Production is the single Windows Desktop. macOS is development only; `apps/web` remains the embedded Tauri frontend.

## Non-goals
- Multiple production devices.
- Public web client.
- Trainer editing/deletion in this slice.
