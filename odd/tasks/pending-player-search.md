# Pending player search

## Goal
Make the monthly pending-payments view show only players who still owe that month and provide the same name search behavior as the main roster.

## Tasks
- [x] Filter the pending view to pending players only and simplify its status presentation.
- [x] Add live player-name search with empty/no-match states.
- [x] Run frontend/API checks and record the outcome.

## Acceptance criteria
- After consulting a month, paid players do not appear in the pending table.
- The pending count reflects only pending players.
- Search filters pending players by name as the user types.
- Existing history navigation and monthly query behavior remain intact.

## Notes
- The API already returns paid/pending status for active players by month.
- The change can remain frontend-scoped while preserving API compatibility.
- Validation: `pnpm build:web` passed and API tests passed (52/52). The known Vite dynamic-import warning remains non-blocking.
- Delivery: pending the next desktop release; existing v0.2.1 will not be overwritten.
