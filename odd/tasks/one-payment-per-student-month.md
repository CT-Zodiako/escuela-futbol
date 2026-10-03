# One payment per student per month

## Goal
Allow at most one payment for each student in each calendar month, using the existing payment date as the covered month.

## Scope
- Reject duplicate student/month payments in the local desktop flow.
- Reject duplicate student/month payments in the API flow.
- Preserve payments for previous and future months when those months have no payment.
- Add deterministic tests and user-facing duplicate-payment errors.

## Non-goals
- Do not add a separate covered-month field.
- Do not change the payment date field or receipt numbering policy.
- Do not merge or delete existing duplicate historical payments automatically.

## Tasks
- [x] Add failing local and API tests for duplicate month rejection and adjacent-month acceptance.
- [x] Implement duplicate month validation in desktop and API payment creation.
- [x] Run focused and regression checks; verify the desktop app behavior.
- [ ] Commit the work unit and record the commit identity.

## Evidence
- RED: desktop sync tests had 2 expected failures and API payment tests had 2 expected failures before implementation.
- GREEN: desktop sync and API payment tests pass after implementation.
- Rule: paymentDate's `YYYY-MM` identifies the covered month; duplicate creation returns a Spanish conflict error and does not allocate a receipt.
- Verification: desktop Rust suite 34/34 passed; API suite 60/60 passed; API and web TypeScript checks passed; `git diff --check` passed.
- Caveat: the running desktop process was an old release binary and requires rebuild/restart before manual verification.

## Known follow-up
- Existing historical duplicates remain visible; the rule applies to new payment creation.
