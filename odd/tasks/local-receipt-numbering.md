# Local receipt numbering

## Goal
Assign persistent, sequential receipt numbers to payments created in the local desktop app.

## Scope
- SQLite receipt counter and safe local allocation.
- Idempotent payment creation without consuming duplicate numbers.
- Backfill from existing imported payments and persistence across restart/reset.
- Focused Rust tests and desktop verification.

## Non-goals
- Do not synchronize receipt sequences between different teams or devices.
- Do not change the web/API receipt allocation path.
- Do not reuse receipt numbers after deletion or reset.
- Do not publish a new release until implementation and checks are complete.

## Tasks
- [x] Add failing Rust tests for first allocation, sequencing, idempotency, persistence, and backfill.
- [x] Implement the SQLite counter and transactional local allocation.
- [x] Run focused checks and desktop build; update evidence.
- [x] Commit the work unit and record the commit identity.

## Evidence
- RED: `cargo test --lib receipt` in `apps/desktop/src-tauri` → 0 passed, 5 failed, 25 filtered out; failures confirm local enqueue still returns `receipt_number: None`.
- GREEN: `cargo test --lib receipt` → 5 passed; `cargo test --lib` → 30 passed; `cargo build --lib` → successful with no warnings.
- Implementation: `apps/desktop/src-tauri/src/sync.rs` adds persistent `receipt_counter`, monotonic snapshot seeding, and atomic idempotent allocation.
- Verification: `cargo test --lib receipt --offline` → 5 passed; `cargo test --lib --offline` → 30 passed; `cargo check --offline --all-targets` → clean; `pnpm build` in `apps/web` → successful; `git diff --check` → clean.
- Caveat: no bundled desktop runtime launch was performed during verification.
- Work-unit commit: `e89e669 feat(desktop): assign local receipt numbers`.

## Known follow-up
- Existing generated receipts may display an ID fallback; after allocation, the history and receipt number should use the local sequence.
