# General monthly payments report

## Goal
Add a Reports tab that shows every player against January–December for a selected year, with paid monthly amounts, monthly totals, player totals, and an XLSX download.

## Tasks
- [x] Add year-based API aggregation and general XLSX export, preserving trainer filtering.
- [x] Add client types/API and a second Reports tab with year selector, grid, totals, and download.
- [x] Verify API/UI build and report edge cases.

## Decisions
- The report uses a selectable calendar year.
- Download format is `.xlsx`.
- Monthly cells show aggregated amount paid in that month; unpaid cells remain blank/dash.

## Evidence
- Existing report route: `apps/api/src/routes/reports.ts`.
- Existing report page: `apps/web/src/pages/ReportsPage.tsx`.
- API tests: 60 passed; API TypeScript check passed; web build passed.
- Desktop Rust tests: 36 passed; desktop general-report tests passed.

## Implementation notes
- Web downloads `.xlsx`; desktop downloads UTF-8 BOM `.csv`, consistent with the existing local Excel-compatible export.
- Both server and desktop aggregate visible payments into 12 calendar-month columns and preserve trainer filtering.
