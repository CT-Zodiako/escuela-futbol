# Offline and online students

## Goal
Allow the single production Desktop installation to create students online or offline, with durable local storage and cloud synchronization just like payments.

## Scope
- Add idempotent student creation using a client mutation UUID.
- Persist a SQLite student outbox and show new students immediately.
- Retry synchronization when connectivity returns.
- Keep the embedded React UI and cloud API; no public web client.

## Tasks
- [x] Add server-side idempotent student creation.
- [x] Add SQLite student outbox and Tauri commands.
- [x] Enable Desktop student creation and retry synchronization.
- [ ] Move the student migration after `20261002000000_payment_outbox_receipts` before applying migrations (controller action; current draft directory is `20260719000000_student_outbox`).
- [ ] Run focused API/Rust tests and regenerate the Prisma client.
- [ ] Verify online/offline/restart synchronization on the production Windows runtime.

## Acceptance criteria
- Desktop can create a student without internet.
- The student appears immediately in the local list as pending.
- Reconnection syncs exactly one server student and clears pending state.
- Existing students and payment references remain valid.

## Implementation notes
- `Student.clientMutationId` is an optional PostgreSQL UUID with a unique index. Legacy browser requests without it still work; new clients supply it. Replays return the original row, including after concurrent insert conflicts.
- A supplied mutation UUID is also the student's permanent ID. Offline payments can therefore reference a new student without remapping existing payment outbox entries.
- SQLite student enqueue/acknowledgement is transactional. Snapshot replacement merges missing pending and acknowledged students before inserting payments; current server copies take precedence, without duplicate rows. A lost response retains the pending indicator until acknowledgement.
- Both outboxes retry on dashboard mount, online events, a 30-second timer, and manual snapshot refresh. Students sync first; one rejected student does not block unrelated payments. Other Desktop mutations remain disabled.
- Acknowledged student payloads remain as a stale-snapshot bridge, matching payment retention. No automatic outbox pruning is introduced.

## Validation handoff
Focused tests were added in `apps/api/src/students.test.ts` and the Rust `sync.rs` test module. They cover replay, unique-conflict recovery, validation, legacy browser creation, snapshot deduplication, acknowledgement, rollback, and payment references. No test/build commands were executed: the parent retained validation ownership and supplied no exact authorized commands. Strict TDD was not activated.

Before release, regenerate Prisma, apply the correctly ordered migration, and validate:
1. Create a student offline; confirm the pending label, then restart Desktop and confirm the row remains.
2. Record a payment for that student offline; reconnect and confirm one server student and one payment with unchanged references.
3. Simulate a lost student POST response, refresh a snapshot, and retry; confirm no duplicate and eventual removal of the pending label.
4. Confirm manual refresh, the online event, and timer clear pending state; verify browser creation and existing payment behavior.
5. Confirm status/payment edits remain disabled on Desktop. Windows is the production acceptance runtime; Mac is development only.

## Non-goals
- Offline student status edits.
- Multiple production devices.
- Public web deployment.
