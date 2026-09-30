# Design Spec — Escuela Futbol

Single source of truth for product-facing design decisions.

## Status

| Phase | File | Status |
| --- | --- | --- |
| 1. Product | 01-product.md | approved |
| 2. Technology | 02-technology.md | approved |
| 3. Flows | 03-flows.md | approved |
| 4. Tokens | 04-tokens.json | approved |
| 5. Components | 05-components.md | approved |
| 6. Patterns | 06-patterns.md | approved |
| 7. Implementation | 07-implementation.md | approved |

Status values: `pending` · `draft` · `approved`

## Decision log

| ID | Question | Answer | Phase file |
| --- | --- | --- | --- |
| P1 | Who uses the system? | One administrator | 01-product.md |
| P2 | Where and when is it used? | Laptop or phone at the field during training and later administrative review | 01-product.md |
| P3 | Primary devices? | PC and mobile equally; adaptive interface | 01-product.md |
| P4 | Technical level? | Basic | 01-product.md |
| P5 | Accessibility needs? | Large visible text, clear controls, intuitive navigation | 01-product.md |
| P6 | Language and locale? | Spanish, DD/MM/YYYY, COP with dot thousands separator, Bogotá timezone | 01-product.md |
| P7 | Current process and pain? | Excel column-by-column entry; formula confusion and calculation errors | 01-product.md |
| P8 | Success criteria? | Simple monthly payment tracking, reports, history, receipts, exports, low friction | 01-product.md |
| D1 | Main entities? | Student, monthly obligation, payment, receipt, and period reports | 01-product.md |
| D2 | Student/payment data? | Name required; document and phone optional; variable payment amount, date, method, paid/pending status | 01-product.md |
| D3 | Computed values? | Expected, collected, missing totals; paid/pending counts; histories; no averages | 01-product.md |
| D4 | Monetary precision? | COP integers, no cents | 01-product.md |
| D5 | Pending condition? | Monthly obligation remains pending until paid during its calendar month | 01-product.md |
| D6 | Lifecycle? | Active/inactive; activation starts billing; deactivation preserves history | 01-product.md |
| D7 | Editing/history? | Payments editable; deletion requires confirmation; history preserved | 01-product.md |
| D8 | Expected volume? | Up to 200 active students | 01-product.md |
| D9 | Import/export? | Export CSV/Excel; no import | 01-product.md |
| D10 | Connectivity? | Internet expected for now | 01-product.md |
| D11 | Missing values? | Name required; document and phone optional; unpaid monthly obligations are pending | 01-product.md |
| D12 | Sequential dependencies? | Reactivation creates obligations only from activation month onward | 01-product.md |
| T1 | Product shape? | Adaptive web application with PWA installation | 02-technology.md |
| T2 | Delivery surfaces? | Browser on PC/mobile plus PWA shortcut; no app store | 02-technology.md |
| T3 | Connectivity and storage? | Internet expected, cloud persistence, cross-device sync, no offline initially | 02-technology.md |
| T4 | Technology priorities? | UX/accessibility, mobile performance, low cost, delivery speed, maintenance, security | 02-technology.md |
| T5 | Existing standard/candidates? | No required standard; compare alternatives prioritizing usability and performance | 02-technology.md |
| T6 | Component strategy? | Prepared component library | 02-technology.md |
| T7 | Responsive strategy? | Adaptive, equal priority on PC and mobile | 02-technology.md |
| T8 | Disqualifiers? | Excessive monthly cost | 02-technology.md |
| T9 | Recommendation status? | Compared alternatives and approved the Railway-based direction | 02-technology.md |
| T10 | Approved technology direction? | React + TypeScript + Vite frontend, TypeScript API, PostgreSQL, all hosted on Railway; PWA delivery | 02-technology.md, tech-notes.md |
| F1 | Key tasks and priority? | Login, students, payments, pending, history, receipts, reports, exports | 03-flows.md |
| F2 | Entry point? | Dashboard panel after login with access to all functions | 03-flows.md |
| F3 | Frequency? | Daily use | 03-flows.md |
| F4 | Bulk operations? | No; individual student operations | 03-flows.md |
| F5 | Destructive actions? | All destructive actions require confirmation | 03-flows.md |
| F6 | Edge cases? | Clear dismissible 5-second alerts; duplicate monthly payment blocked; empty states; connection retry preserving form | 03-flows.md |
| F7 | Time/steps? | Payment max 3 steps; search max 2; monthly status max 2; receipt max 3 | 03-flows.md |
| K1 | Existing brand? | None | 04-tokens.json |
| K2 | Visual personality? | Serious and professional | 04-tokens.json |
| K3 | Color mode? | Light only | 04-tokens.json |
| K4 | Density? | Comfortable, prioritizing readability and touch targets | 04-tokens.json |
| K5 | Corner style? | Slightly rounded | 04-tokens.json |
| K6 | Motion? | None | 04-tokens.json |
| K7 | Status colors? | Paid green, pending amber, error red, neutral/info blue/gray; always paired with text/icon | 04-tokens.json |
| C1 | Inventory | 17 components confirmed from screen inventory | 05-components.md |
| C2 | Table behavior | No column sorting, fixed alphabetical order; all-column search; dynamic viewport-based pagination, sticky footer with no scroll to reach "Siguiente" | 05-components.md |
| C3 | Amount input keyboard | Numeric keyboard on mobile; explicit save button, never covered by the keyboard | 05-components.md |
| C4 | Form size | Single adaptive size, no separate desktop/mobile variants | 05-components.md |
| C5 | Icons | Yes, filled style | 05-components.md |
| A1 | Validation timing? | Live while typing plus on save | 06-patterns.md |
| A2 | Unsaved-changes definition? | Only when value differs from original, not merely touched | 06-patterns.md |
| A3 | Success/error feedback? | Same Alert component; only color/icon/message change | 06-patterns.md |
| A4 | Export scope? | Exported files list only completed payments, not pending months; pending screen and report totals unaffected | 06-patterns.md |
| A5 | Accessibility target? | WCAG 2.2 AA confirmed | 06-patterns.md |
| A6 | Print/export layouts? | Print-friendly receipt view plus downloadable receipt image for sharing | 06-patterns.md |
| I1 | First slice? | Login + register student + register payment | 07-implementation.md |
| I2 | Non-goals of first slice? | Pending, history, reports, receipts, export, edit/delete payments, activation lifecycle | 07-implementation.md |
| I3 | Allowed surfaces? | Login, minimal Dashboard, Student form, Payment form, simple student list; `students`/`payments` tables | 07-implementation.md |
| I4 | Data schema? | `students`, `payments` (unique per student/month), admin auth | 07-implementation.md |
| I5 | Verification? | Backend automated tests + manual login + manual PC/mobile verification | 07-implementation.md |
| I6 | States to demonstrate? | Empty state, connection-loss recovery, validation errors, keyboard/focus accessibility | 07-implementation.md |
| I7 | Acceptance evidence? | PC/mobile screenshots, automated test results, one real student + real payment confirmed by user | 07-implementation.md |
| I8 | Dependents? | Every remaining feature depends on this slice | 07-implementation.md |
| I9 | Review size? | Small enough for one focused review | 07-implementation.md |

## Open TBDs

See `design/01-product.md` for unresolved product decisions. These will be resolved in the relevant later phases.

## Changelog

| Date | Phase | Change | Impacted UI |
| --- | --- | --- | --- |
| 2026-09-29 | 1 | Created the initial Escuela Futbol product draft from the discovery answers | — |
| 2026-09-29 | 1 | Phase 1 Product approved | — |
| 2026-09-29 | 2 | Drafted technology comparison: React/Vite + Supabase, Next.js + Supabase, Vue/Nuxt + Supabase, and Firebase alternative | 02-technology.md |
| 2026-09-29 | 2 | Phase 2 approved: React + Vite PWA, TypeScript API, Railway PostgreSQL, and Railway hosting | 02-technology.md, tech-notes.md |
| 2026-09-29 | 3 | Drafted core flows, screen inventory, validation, empty states, and connection-loss behavior | 03-flows.md |
| 2026-09-29 | 3 | Phase 3 Flows approved | — |
| 2026-09-29 | 4 | Drafted light professional token system with comfortable spacing, rounded controls, no motion, and payment status colors | 04-tokens.json |
| 2026-09-29 | 4 | Phase 4 Tokens approved | — |
| 2026-09-29 | 5 | Drafted component inventory and specs: dynamic-height pagination, all-column search, numeric-keyboard payment input, filled icons, adaptive modal size | 05-components.md |
| 2026-09-29 | 5 | Phase 5 Components approved | — |
| 2026-09-29 | 6 | Drafted patterns: dual validation timing, unsaved-changes rule, shared success/error alert, paid-only export scope, WCAG 2.2 AA, printable/image receipt | 06-patterns.md |
| 2026-09-29 | 6 | Phase 6 Patterns approved | — |
| 2026-09-29 | 7 | Drafted implementation plan: Slice 1 (login, students, payments) with data schema, tests, acceptance criteria, and explicit non-goals | 07-implementation.md |
| 2026-09-29 | 7 | Phase 7 Implementation approved. All design phases (1–7) approved | — |
| 2026-09-29 | 1, 3, 5, 7 | Reversed the one-payment-per-student-per-month rule and required covered-month field; payments now allow duplicates per month and use an optional free-text observation instead | 01-product.md, 03-flows.md, 05-components.md, 07-implementation.md, apps/api, apps/web |
