# Delete student with cascading payments

## Goal
Allow operators to permanently delete a student and all of their payment records from the local SQLite database.

## Scope
- Add a "Eliminar" action to the student roster (desktop/table views).
- Show a confirmation dialog explaining that deletion is permanent and will remove all payments.
- Implement a Tauri command that deletes the student row and all payment rows referencing that student.
- Refresh the roster after deletion.
- Add focused Rust tests for the cascade behavior.

## Non-goals
- Soft delete / recycle bin.
- Undo after deletion.
- Deleting trainers or administrators.

## Proposed UI
- A red "Eliminar" button in the student card (mobile) and an additional column in the desktop table.
- Confirmation text: "¿Eliminar a {name}? Esta acción no se puede deshacer y se borrarán todos sus pagos."

## Tasks
- [x] Add Tauri command to delete a student and cascade-delete their payments.
- [x] Wire command through `desktop.ts` and `client.ts`.
- [x] Add delete button and confirmation in `DashboardPage.tsx`.
- [x] Add Rust tests for cascade deletion.
- [x] Verify builds and publish v0.3.11.

## Evidence
- Rust tests: 43 passed in `cargo test --lib` (includes `delete_student_removes_student_and_all_related_payments` and `delete_student_leaves_other_students_and_payments_intact`).
- Web build: `pnpm build:web` succeeded.
- Desktop build: `pnpm build:desktop` succeeded (macOS bundle).
- Release: published via tag `v0.3.11` and GitHub Actions workflow.
- Commit: `1b91d70`

## Constraints
- Desktop-only; no web/API changes.
- Preserve other students, trainers, payments, and the receipt counter.
- Deletion must be explicit and confirmed by the user.
