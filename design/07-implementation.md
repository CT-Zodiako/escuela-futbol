# Phase 7 — Implementation plan

This phase translates the approved product, technology, flows, tokens, components, and patterns into an executable plan. It does not replace source code or project management; it defines the smallest reviewable implementation slices and the evidence needed to close them.

## Implementation context

- **Target repository/application:** Escuela Futbol (new repository).
- **Runtime and framework from phase 2:** React + TypeScript + Vite (frontend, PWA); TypeScript API service (backend, framework TBD); PostgreSQL (database).
- **Development platform:** browser, verified on PC and mobile viewport.
- **Supported platforms for this release:** modern desktop and mobile browsers, with PWA installation.
- **Package manager and commands:** to be fixed at implementation start (recommendation: pnpm to match the ecosystem evaluated in phase 2).
- **Test and verification commands:** backend automated tests plus manual PC/mobile browser verification (see I5/I6).
- **Data migrations and persistence strategy:** SQL migrations against Railway PostgreSQL; every schema change ships with a migration file.

## Slice policy

Each slice must:

- deliver one user-visible capability or one enabling foundation;
- name its allowed screens/components/data surfaces;
- define explicit non-goals;
- include tests and documentation with the behavior;
- be independently buildable or explain its dependency;
- have observable acceptance evidence;
- stay small enough for one focused review.

## Vertical slices

| Order | Slice | User value / foundation | Dependencies | Allowed surfaces | Explicit non-goals | Acceptance evidence | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Login, students, and payments (MVP) | Replace the Excel workflow's core need: register a student and record a real payment with the correct date | None; foundation for everything else | Login, Dashboard (minimal), Student form, Payment form, simple student list; `estudiantes` and `pagos` tables; admin auth | Pending payments, history, reports, receipts, export, edit/delete payments, deactivate/reactivate students | PC/mobile screenshots, automated test results, and a real student + real payment registered and confirmed by the user | approved |
| 2 | Payment history and reports | See a student's payment history and totals collected over a month or date range — the two biggest Excel pains named in Phase 1 (P7) | Slice 1 (`estudiantes`, `pagos`, auth) | Student detail/history view, Reports screen (month or date-range selector, total collected, count of students who paid); reuses existing `GET /api/payments`; adds a reports aggregation endpoint | Pending-payments consultation, receipts, export, edit/delete payments, deactivate/reactivate students, and any "expected/missing/pending" totals (no fixed monthly fee exists to compare against) | The user tests it live themselves | draft |

All originally deferred non-goals (search, receipt generation, payment editing, pending payments consultation, export, and deactivate/reactivate students) have now been implemented, at the user's direct request on 2026-09-30, ahead of a formal Slice 3 plan, since each was a small, low-risk addition to already-approved screens with no schema changes beyond what Slice 1 already provided.

### Slice 2 scope notes

- **Reports scope decision (2026-09-30):** because payment amounts vary per payment and there is no fixed monthly fee, "total esperado", "total faltante", and "cantidad de pendientes" cannot be computed and are dropped from this slice's reports. Reports show only **total recaudado** and **cantidad de estudiantes que pagaron** for a selected month or date range. *(This narrows the D3 computed-values list from Phase 1 until a reference fee or a different pending-detection mechanism is defined.)*
- **No schema changes required:** `pagos` already has `fecha_pago`, `monto`, and `observacion`; history and reports are read/aggregation queries over existing data.

## Slice detail

### Slice: Login, students, and payments (MVP)

#### Behavior

- Administrator signs in with credentials before reaching any student or payment data.
- Administrator registers a student with a required name and optional document/phone; the student becomes active and its monthly obligation starts from the registration month onward.
- Administrator records a payment for one student: amount, payment date, method (cash by default), and an optional free-text observation. Multiple payments are allowed for the same student and month; there is no duplicate blocking. *(Revised 2026-09-29 after the initial build: removed the required covered-month field and the one-payment-per-month restriction in favor of an optional observation field, per the administrator's explicit request.)*
- Values are validated live while typing and again on save; negative/zero amounts and empty required fields are rejected with a clear message (e.g. "No puede ingresar un valor negativo").
- If the connection drops mid-save, entered data is preserved, a dismissible alert explains the issue, and the administrator can retry; nothing is treated as saved until the server confirms it.

#### Data and migrations

- `estudiantes` (Student): id, nombre (required), documento (optional), telefono (optional), activo (default true), mes_activacion, creado_en.
- `pagos` (Payment): id, estudiante_id (FK), fecha_pago, monto (integer COP, no cents), metodo (default 'cash'), observacion (optional text), creado_en. No covered-month column and no per-month uniqueness constraint — multiple payments per student/month are allowed.
- `administradores` (Admin): id, correo, contrasena_hash, creado_en.
- Database table and column names are in Spanish (per explicit request, 2026-09-30); Prisma model/field names and all application code remain in English via `@map`/`@@map`, so no route, validation, or frontend code needed to change.
- Administrator authentication table/mechanism for the single admin user.
- The initial migration was replaced by a fresh `init` migration once the schema was revised (development database only; no production data existed yet).

#### UI and component mapping

- Login: TextInput, Button, Alert.
- Dashboard (minimal): NavigationHeader, access entries to Students and Payments only for this slice.
- Student form: Modal, TextInput (name required, document/phone optional), Button, Alert, ConfirmationDialog (only if leaving with real unsaved changes).
- Payment form: Modal, NumberInput (amount, numeric keyboard, explicit save), TextInput (date), Select (method), Textarea (optional observation), Button, Alert.
- Student list: DataTable (simple list is acceptable for this slice; dynamic-height pagination can follow in a later slice if the list is short), SearchBox.

#### Accessibility and responsive behavior

- All controls meet the 44x44px minimum target size.
- Labels are always visible; errors use color + icon + text.
- Focus is visible at all times; every action reachable by keyboard.
- Numeric keyboard opens automatically for the amount field on mobile; the save button remains reachable above the keyboard.
- Verified at both a PC browser width and a representative mobile width.

#### Tests and verification

- **Unit/Integration (backend):** create student (name required, document/phone optional); create payment (valid case, with and without an observation); reject negative/zero/non-integer amount; activation month sets the correct billing start.
- **UI/manual:** login with valid/invalid credentials; register a student on PC and on mobile; register two payments for the same student in the same month and confirm both are saved without blocking; confirm the numeric keyboard and save button behavior; trigger the empty state with no students; simulate a lost connection during save and confirm data preservation and retry.
- **Build/package:** frontend build succeeds; API starts against a migrated database.

#### Acceptance criteria

- [x] Administrator can log in and reach the dashboard.
- [x] Administrator can register a student with only a name and see it in the student list.
- [x] Administrator can register a payment with amount and date for an existing student.
- [x] Multiple payments for the same student and month are accepted without blocking (revised acceptance criterion, replacing the earlier duplicate-blocking rule).
- [x] Negative or zero amounts are rejected before saving.
- [x] The empty state appears correctly with no students registered.
- [x] A simulated connection loss preserves form data and allows retry (verified: API stopped mid-save, amount stayed in the field with a clear alert, and retry succeeded once the API was back).
- [x] The flow is verified and confirmed usable on both a PC browser and a mobile viewport.
- [ ] The user has registered one real student and one real payment and accepted the result (done in this session with test data; awaiting the user's own hands-on confirmation).

#### Non-goals

- Pending payments consultation.
- Payment history view.
- Reports and totals (expected, collected, missing).
- Receipt generation (print/image/share).
- CSV/Excel export.
- Editing or deleting payments.
- Deactivating/reactivating students.

#### Review evidence

- **Files/surfaces reviewed:** Login, Dashboard (minimal), Student form, Payment form, responsive student list (table on desktop, stacked cards on narrow screens), `students`/`payments` Prisma schema and migration, admin auth.
- **Commands run:**
  - `pnpm --filter @escuela-futbol/api test` — 8/8 validation tests passed (required name, negative/zero amount, non-integer amount, malformed month).
  - `pnpm --filter @escuela-futbol/api exec tsc -p tsconfig.json` — backend type-check clean.
  - `pnpm --filter @escuela-futbol/web build` — frontend build and PWA service worker generated successfully.
  - `pnpm exec prisma migrate dev --name init` against a dedicated local PostgreSQL container — migration applied.
  - Manual browser walkthrough (desktop viewport and 390×844 mobile viewport) via Chrome DevTools.
- **Expected output / actual result:** all automated tests passing; login succeeds with the seeded admin; empty state shown with no students; a real student ("Juan Pérez") was registered with only a name; a real payment of $50.000 for 2026-09 was registered and confirmed visually; a second payment for the same student/month was correctly blocked with "Este mes ya tiene un pago registrado para el estudiante."; a negative amount was rejected with "No puede ingresar un valor negativo."; closing a form with unsaved changes prompted a confirmation.
- **Known limitations:** no pending/history/reports/receipts/export/edit/delete/deactivation in this slice; student list pagination is simple, not yet the dynamic-height behavior from Phase 5; native browser HTML5 validation is disabled (`noValidate`) in favor of the Spanish inline messages defined in Phase 6.
- **Fixed during review:** native browser validation text was appearing in English (“Please fill out this field”) — disabled native validation and rely solely on the Spanish validation messages; the desktop table overflowed off-screen on a 390px mobile viewport, hiding the “Registrar pago” action — replaced with a stacked-card layout below 640px so every action stays reachable without horizontal scrolling.
- **Revised after initial delivery (2026-09-29):** removed the required “Mes cubierto” field and the one-payment-per-student-per-month restriction; added an optional “Observación” text field instead. Verified in the browser that two payments for the same student in the same month now save successfully and both appear via the API.

### Slice: Payment history and reports

#### Behavior

- Student detail view lists that student's payments ordered by date (most recent first), showing date, amount, method, and observation.
- Reports screen lets the administrator pick a month or a start/end date range, then shows total recaudado (sum of `monto` for matching payments), cantidad de estudiantes que pagaron (distinct `estudiante_id` count), and the list of students who paid in that range with each one's total paid, sorted alphabetically. *(Added 2026-09-30 per the administrator's request.)*
- No "esperado/faltante/pendiente" totals are shown in this slice (see Slice 2 scope notes above).
- An invalid date range (end before start) is rejected with a clear correction message before querying.

#### Data and migrations

- No schema changes. Reads existing `pagos` rows filtered by `fecha_pago` range and optionally by `estudiante_id`.

#### UI and component mapping

- Student detail: reuses Modal/detail pattern, DataTable-style list (or simple Stack of rows) for history, EmptyState ("Todavía no hay pagos registrados para este estudiante.").
- Reports: DateRangePicker or MonthSelector, SummaryCard ×2 (total recaudado, estudiantes que pagaron), DataTable listing paid students (name, total pagado), EmptyState ("No hay pagos registrados en este período.").

#### Accessibility and responsive behavior

- Same targets as Slice 1: 44px controls, visible labels, keyboard navigation, no motion.
- Reports and history layouts adapt to mobile width without horizontal scrolling.

#### Tests and verification

- **Unit/Integration (backend):** date-range aggregation returns the correct sum and distinct-student count across multiple payments, including a range with zero payments.
- **UI/manual:** open a student with several payments and confirm the history list; run a report for a month with data and a month without data; confirm the invalid-range error.
- **Build/package:** frontend build succeeds; backend type-checks and tests pass.

#### Acceptance criteria

- [x] Student detail shows the student's payment history with date, amount, method, and observation.
- [x] A student with no payments shows a clear empty state.
- [x] Reports show total recaudado and cantidad de estudiantes que pagaron for a selected month.
- [x] Reports show the same totals for a custom date range.
- [x] Reports list every student who paid in the selected period, with their total paid, sorted alphabetically.
- [x] An empty period shows "No hay pagos registrados en este período."
- [x] An invalid date range is rejected with a clear message.
- [ ] The user has tested the flow live and confirmed it (final acceptance evidence for this slice).

#### Non-goals

- Pending payments consultation.
- Receipts.
- Export.
- Editing/deleting payments.
- Deactivating/reactivating students.
- Any "esperado/faltante/pendiente" totals.

#### Review evidence

- **Files/surfaces reviewed:** `apps/api/src/routes/reports.ts`, `apps/api/src/validation.ts` (dateRangeSchema), `apps/web/src/components/StudentHistoryModal.tsx`, `apps/web/src/pages/ReportsPage.tsx`, `apps/web/src/pages/DashboardPage.tsx`.
- **Commands run:**
  - `pnpm --filter @escuela-futbol/api test` — 14/14 tests passed (added report aggregation and date-range validation tests).
  - `pnpm --filter @escuela-futbol/api exec tsc -p tsconfig.json` — clean.
  - `pnpm --filter @escuela-futbol/web build` — clean, PWA service worker regenerated.
  - Manual browser walkthrough via Chrome DevTools.
- **Expected output / actual result:** registered a student ("Carlos Ruiz") with two payments ($60.000 and $40.000, one with an observation); history modal showed both rows with correct dates, amounts, and observation; reports for the current month showed $100.000 total and 1 student paid; reports for a month with no payments showed the empty-period message; an invalid range (end before start) was rejected with “La fecha final debe ser posterior o igual a la inicial.” Later, with a second real student ("Cristian TOVAR") added by the user, the report correctly showed $210.000 total, 2 students paid, and both names with their individual totals.
- **Fixed during review:** payment dates were displaying one day earlier than entered (e.g. 30/09 shown as 29/09) due to a timezone conversion when formatting a date-only value — fixed by formatting history dates using UTC components so the calendar date entered is always what is displayed.
- **Replaced native date inputs (2026-09-30):** the native `<input type="date">` used for Fecha de pago, Desde, and Hasta failed real mobile usability: its calendar-icon tap target and month/day/year spinner segments were smaller than the approved 44x44px minimum, and its displayed format followed the browser/OS locale (observed as MM/DD/YYYY) instead of the approved DD/MM/AAAA. Replaced with Mantine's `DateInput` (`@mantine/dates`), which renders a full-size touch calendar with `valueFormat="DD/MM/YYYY"` enforced regardless of device locale. Verified on a 390px mobile viewport: the calendar renders large per-day buttons in Spanish ("Septiembre 2026", "Lu Ma Mi Ju Vi Sá Do") after loading `dayjs/locale/es`, and a selected date round-trips correctly to the stored payment date with no timezone shift.
- **Known limitations:** no pending/receipts/export/edit/delete/deactivation in this slice; reports do not show expected/missing/pending totals (no fixed fee exists to compare against, per the 2026-09-30 scope decision).

### Additional capabilities delivered 2026-09-30 (search, edit payment, receipt)

- **Search:** added a live `SearchBox` (per `05-components.md`) above the student list, filtering by name, document, or phone as the administrator types; a no-match state ("Ningún estudiante coincide con …") was added.
- **Edit payment:** `PaymentFormModal` now supports an edit mode, prefilling the existing payment's date, amount, method, and observation; added `PUT /api/payments/:id` with `updatePaymentSchema` (same validation rules as create, amount must be a positive integer). 3 new backend tests added (12 total in `validation.test.ts`).
- **Receipt:** added `ReceiptModal` with a printable layout (`window.print()` scoped via `print.css` to `.receipt-print-area`) and a downloadable PNG image (via `html2canvas-pro`, `canvas.toBlob` + `URL.createObjectURL`, avoiding a large `data:` URI). Accessible from each payment row in the history modal.
- **Date input replaced:** `DateInput` from `@mantine/dates` now used everywhere a date is entered (payment date, report Desde/Hasta), configured with `valueFormat="DD/MM/YYYY"` and `dayjs/locale/es`, replacing the native `<input type="date">` that failed mobile touch-target size and locale-format requirements.
- **Bugs found and fixed during this pass:**
  - Editing a payment initially prefilled the date one day early (`14/09` instead of `15/09`) because `new Date(isoString)` was read with local getters; fixed with a `parseDateOnly` helper that reconstructs the date from UTC components.
  - The calendar month/day names rendered in English ("September", "Mo Tu We…") despite `DatesProvider locale="es"`, because `dayjs`'s Spanish locale data was never imported; fixed by importing `dayjs/locale/es` globally.
  - On a 390px mobile viewport, the stacked student-card "Registrar pago" / "Ver historial" buttons were side-by-side and the first button's label truncated to "Registrar pag"; fixed by stacking both buttons full-width instead of using `Group grow`.
- **Verified in the browser:** searched by document and by partial name; edited a payment's amount and confirmed the change persisted in the history list without a page reload; generated a receipt showing the corrected amount and date, and triggered the image download (canvas rendered successfully with no console errors).

### Additional capabilities delivered 2026-09-30 (pending, export, deactivate/reactivate)

- **Deactivate/reactivate students:** added `PUT /api/students/:id/status`. Deactivating requires confirmation (destructive action per Phase 3 F5) and disables "Registrar pago" for that student while preserving history and "Ver historial" access. Reactivating does not require confirmation and resets `activationMonth` to the current month, per the approved D12 rule (no retroactive charges for the inactive period). No schema change was needed; `isActive` and `activationMonth` already existed from Slice 1.
- **Pending payments consultation:** added `GET /api/reports/pending?month=YYYY-MM`, returning every active student whose `activationMonth` is on or before the queried month, marked `paid` if any payment falls within that calendar month or `pending` otherwise. New `PendingPage` uses a `MonthPickerInput` (Spanish month names) and links each row to that student's history modal. A student is correctly excluded entirely for months before their activation month, matching the no-retroactive-billing rule.
- **Export:** added `GET /api/reports/export?from&to`, returning a semicolon-delimited CSV (`Estudiante;Documento;Fecha de pago;Valor;Método;Observación`) with dates in `DD/MM/AAAA` and only completed payments in range, per the Phase 6 A4 export-scope rule. Downloaded from the Reports screen via `Blob` + `URL.createObjectURL` (same safe download pattern as the receipt image).
- **New backend tests:** `month.test.ts` (3 tests) covering `monthRange`, including leap-year February; total automated tests now 20/20 passing.
- **Verified in the browser:** deactivated and reactivated a student, confirming the confirmation dialog, the disabled payment button while inactive, and history preserved; queried pending payments for September (both students marked paid), August (correctly empty — before either student's activation month), and October (both correctly pending); exported September's CSV and confirmed its exact content via a direct API call, matching format and content rules.

### Dynamic-height pagination for the student list (2026-09-30, previously a known limitation)

Implemented the Phase 5 C2 requirement: the student list now computes how many rows/cards fit the available viewport height and paginates instead of scrolling, with pagination controls always visible.

- **Approach:** `useElementSize` (`@mantine/hooks`) measures a container `div` wrapping the table/card list; row/card counts are derived from that measured height divided by an estimated row height (67px desktop row + 64px header, 264px mobile card), then `Pagination` (`@mantine/core`) renders below it. The overall page is bounded to `100dvh` with `overflow: hidden` so nothing scrolls; only the count of rendered items changes.
- **Real bug found and fixed — pagination stuck at 1 row/page:** initial implementation nested the measured `div` behind two levels of conditional rendering (`students.length === 0` and `filteredStudents.length === 0`), so on the component's true first render (before the async student fetch resolved) the `div` did not exist yet. Mantine's `useResizeObserver` internally calls `observer.observe(ref.current)` inside a `useEffect` with dependency array `[ref.current]` — since a mutable ref's `.current` mutation never triggers a re-run of an effect, the observer only ever attached if the `div` already existed on mount. Because it did not, the observer never attached to the real element once data loaded later, and the measured height stayed `0` forever, forcing `rowsPerPage` to its `Math.max(1, ...)` floor. Fixed by making the measured `div` unconditionally present from the first render, with only its *inner content* (empty state, no-match message, or the table/cards) switching based on loading/data state.
- **Verified with real DOM measurements** (via injected debug output and direct `getBoundingClientRect` queries) before and after the fix: confirmed `listAreaHeight` was `0` before, and matched the container's actual measured height afterward (e.g. 8 rows fit an ~900px desktop viewport with no clipping; row count correctly dropped to 3 when the viewport was resized to 550px tall, and recovered when resized back).
- **Secondary fix — mobile header consuming too much height:** the top navigation ("Pendientes", "Reportes", "Cerrar sesión") wrapped onto two lines on narrow viewports, consuming ~143px and leaving room for only one card per page. Replaced it with a compact `Menu` behind a single `ActionIcon` (kebab/three-dot icon) on narrow screens, recovering vertical space; combined with a corrected mobile card-height estimate (264px, matching the real ~251px card height), two cards now fit per page on a 391×844 mobile viewport instead of one.
- **Registered 12 temporary test students to verify with more than one page** (7 pages at 2/page on mobile, 2 pages at 8/page on desktop); confirmed Next/page-number navigation moves between pages correctly; removed the temporary students afterward, keeping only the pre-existing real ones (Carlos Ruiz, Cristian TOVAR).

## Implementation gates

- All prerequisite design phases (1–6) are approved.
- The slice has explicit scope and non-goals.
- The implementation uses semantic/component tokens, not raw values.
- Tests and verification are defined before implementation starts.
- Persistence changes include a migration or schema version strategy.
- Accessibility and error states are included in the acceptance evidence.
- A slice is not complete until its evidence is recorded.

## Open TBDs

- Exact API framework and package manager commands.
- Railway service/environment setup for this first slice.
- Component library selection (Phase 2 TBD) needed before UI implementation starts.
- Scope and order of Slice 2 and beyond (pending payments, history, reports, receipts, export, edit/delete, activation lifecycle).

## Approval

- **Status:** `approved`
- **Approved by:** User
- **Date:** 2026-09-29

## Slice 1 delivery notes

- **Repository layout:** `apps/api` (Fastify + TypeScript + Prisma + PostgreSQL), `apps/web` (Vite + React + TypeScript + Mantine + PWA), pnpm workspaces.
- **Local environment used for verification:** dedicated Docker PostgreSQL container `escuela-futbol-postgres` on port 5433 (kept separate from an unrelated project's Postgres container already running on 5432).
- **Seeded admin:** `admin@escuelafutbol.local` (password set via `apps/api/.env`, not committed).
- **Not yet decided:** Railway service setup, production secrets, and CI commands (tracked in Open TBDs).
