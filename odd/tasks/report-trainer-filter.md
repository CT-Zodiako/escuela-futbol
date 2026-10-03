# Trainer filter for reports

## Goal
Allow reports to show all trainers or only one selected trainer.

## Scope
- Add optional trainer filter to summary and CSV report APIs.
- Add an "Todos los entrenadores" selector and trainer options to ReportsPage.
- Preserve existing date filters and totals.

## Tasks
- [x] Add optional trainerId filtering to report APIs and tests.
- [x] Add trainer selector to reports UI and pass it to summary/export.
- [ ] Verify API tests and web/Desktop builds.

## Acceptance criteria
- Default selection is all trainers.
- Selecting a trainer filters totals, students, payments, and CSV export.
- Existing reports without a trainer filter behave unchanged.

## Implementation notes
- Summary and CSV accept an optional UUID `trainerId` and filter through the student's current trainer; omission preserves all trainers.
- The selector loads with `api.listTrainers()`, including the Desktop local list. Reports still require connectivity.
- Focused route tests cover authentication, invalid/empty UUIDs, relation scoping, unchanged dates, totals, and CSV output.
- Validation is pending parent execution; no tests or builds were run by the implementation writer.

## Non-goals
- Offline reports in this slice.
- Trainer editing/deletion.
