# Edit student

## Goal
Allow operators to edit a player's name, trainer, document, and phone while preserving status, activation month, and payment history.

## Scope
- Add edit mode to the existing student form modal.
- Add API and local SQLite update operations with the same validation rules as creation.
- Preserve student identity, status, activation month, and payments.
- Refresh the roster after a successful edit and show validation errors.

## Non-goals
- Do not edit active/inactive status from this form.
- Do not change activation month or payment history.
- Do not touch the peer-owned general report implementation except preserving existing report additions in shared files.

## Tasks
- [x] Add failing API, desktop, and UI-facing tests for valid edits and validation failures.
- [x] Implement API/local update operations and edit-mode UI.
- [ ] Run focused and regression checks; manually verify the desktop flow.
- [ ] Commit the work unit and record the commit identity.

## Evidence
- RED: API PUT tests initially returned 404; Rust tests initially failed to compile because StudentUpdate/update_student_local were absent.
- GREEN: implementation added API, local SQLite, Tauri command, web client, edit modal, and roster actions; focused API/Rust/web checks pending final verification.

## Known follow-up
- Existing duplicate documents or phones are not deduplicated automatically; edit validation follows current creation rules.
