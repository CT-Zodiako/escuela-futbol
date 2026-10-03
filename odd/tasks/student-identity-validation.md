# Student identity validation

## Goal
Require student documents to contain digits only with no spaces or punctuation, require phone numbers to contain exactly 10 digits, and display stored documents with thousands separators without changing the stored value.

## Scope
- API create-student validation.
- Desktop SQLite create-student validation.
- Student registration form input sanitization and submit errors.
- Student roster display for desktop card/table views.
- Deterministic tests for API and Rust validation.

## Non-goals
- Do not rewrite existing stored documents.
- Do not format phone numbers in the display.
- Do not change WhatsApp phone normalization behavior.
- Do not change the release version or publish while this task is uncommitted.

## Tasks
- [x] Add failing API/Rust validation tests.
- [x] Implement digit-only document and exact 10-digit phone validation.
- [x] Sanitize form input and format document display with thousands separators.
- [x] Run focused tests and local Desktop build.
- [x] Commit as a separate work unit before continuing the release.

## Evidence
- RED (API): `vitest run src/validation.test.ts` → 2 failed (`rejects documents containing anything other than digits`, `requires a phone with exactly 10 ASCII digits`), 20 passed.
- RED (Rust): `cargo test --offline student_identity` → `student_identity_rejects_non_digit_documents_and_wrong_phone_shapes` FAILED (case 0: `"1030 456 789"` accepted).
- GREEN (API): `vitest run src/validation.test.ts` → 22/22 passed.
- GREEN (Rust): `cargo test --offline` → 25/25 passed (including all v0.2.3 reset and local-only durability tests).
- GREEN (Web): `pnpm --filter @escuela-futbol/web build` → built successfully (tsc + vite + PWA).
- GREEN (API full suite): `pnpm run test:api` → 8 files, 58 tests passed, 0 failed. The root `pnpm test` command is not defined.
- GREEN (Desktop): `cargo test --offline` → 25/25 passed; local macOS Tauri build completed successfully.
- Work-unit commit: `85d4393 feat(validation): validate student identity fields`.
- Implementation: `apps/api/src/validation.ts` (`document: /^\d+$/`, `phone: /^\d{10}$/`); `apps/desktop/src-tauri/src/sync.rs` (`valid_student_identity` enforced in `enqueue_student_local` only — snapshot replace path unchanged); `StudentFormModal.tsx` strips non-digits on input, caps phone at 10 digits, submit errors in Spanish; `DashboardPage.tsx` `formatDocument` (period separators, display-only; raw digits kept for search/writes; phones untouched).

## Known follow-up
- The root `pnpm test` script is not defined; use `pnpm run test:api` for the API suite.
