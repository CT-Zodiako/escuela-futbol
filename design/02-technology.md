# Phase 2 — Technology recommendation

This phase compares implementation directions. It is a recommendation, not a final irreversible architecture decision. Confirmed choices belong in `tech-notes.md` after approval.

## Product shape

- **Product category:** adaptive administrative web application with a PWA install path.
- **Primary delivery surface:** browser on PC and mobile; installable PWA shortcut.
- **Primary devices:** PC and mobile equally.
- **Connectivity:** internet expected; no offline mode in the first version.
- **Data sensitivity:** student identity/contact data and payment records; protect with authentication, authorization, encrypted transport, and database rules.
- **Requirements:** cloud persistence and synchronization across devices; CSV/Excel-compatible export; printable/shareable receipt output.
- **Hosting constraint:** Railway is already paid for and should host the application services where practical.
- **Team constraints:** no existing technology standard; administrator has basic technical level; operation cost must remain low.

## Decision criteria

| Criterion | Weight | Evidence from product phase | Notes |
| --- | ---: | --- | --- |
| User experience and accessibility | 6 | Basic administrator; large text, clear controls, intuitive navigation | Component library must support semantic and keyboard-accessible controls. |
| Responsive/mobile performance | 5 | PC and mobile equally; field use during training | Avoid excessive JavaScript and oversized UI bundles. |
| Operating cost | 4 | Monthly cost above all else is disqualifying | Prefer a useful free/low-cost starting tier and portable data. |
| Delivery speed | 3 | Need a practical first version | Mature ecosystem and prepared components reduce custom work. |
| Long-term maintenance | 2 | No existing team standard | Prefer mainstream technologies and clear separation of UI/data. |
| Data security | Mandatory | Payment and contact data | Security is a release gate regardless of its ranking. |

## Candidate approaches

| Candidate | Strengths | Risks/tradeoffs | Fit | Evidence/version | Decision |
| --- | --- | --- | --- | --- | --- |
| React + Vite + Railway API/PostgreSQL | Mature UI ecosystem; fast SPA/PWA delivery; relational PostgreSQL fits payment history and date-range reports; uses the already-paid provider; full control over API and exports | Requires building authentication, authorization, API, migrations, backups, and security policies; hosting configuration is our responsibility | Highest | Current mainstream ecosystem; verify selected versions during implementation | Recommended |
| Next.js + Railway PostgreSQL | React ecosystem plus server routes and flexible deployment; can combine frontend and backend concerns | More framework complexity than this administrative app needs; server rendering is not required; deployment model can become less explicit | High, but heavier | Current mainstream ecosystem; verify selected versions during implementation | Alternative |
| Vue + Nuxt + Railway PostgreSQL | Productive component model; strong responsive web support; can serve full-stack routes | No existing team preference; component/accessibility choices need validation; more framework surface than a simple SPA requires | Medium-high | Current mainstream ecosystem; verify selected versions during implementation | Alternative |
| React + Firebase | Fast hosted authentication and realtime options | NoSQL model is less natural for monthly obligations and relational reports; adds another provider despite Railway; migration/export and cost behavior need monitoring | Medium | Current mainstream ecosystem; verify selected versions during implementation | Not preferred |

## Recommendation

- **Recommended delivery model:** responsive single-page web application with PWA manifest and installability.
- **Recommended delivery model:** React + TypeScript + Vite frontend, deployed on Railway as a static service; separate API service and PostgreSQL database on Railway.
- **Recommended application framework/runtime:** React + TypeScript + Vite for the frontend; a small TypeScript API service for the backend, with the exact API framework selected during implementation.
- **Recommended component strategy:** prepared accessible component library, selected during implementation after checking mobile behavior, keyboard support, and bundle impact.
- **Recommended styling/token strategy:** project-owned semantic design tokens consumed by the component library; no raw colors or spacing values in feature UI.
- **Recommended data/storage direction:** Railway-hosted PostgreSQL behind the API. Model students, activation periods, monthly obligations, payments, and receipt metadata relationally. The API owns validation and authorization.
- **Responsive strategy:** adaptive layout with mobile-first constraints and desktop enhancements; PC and mobile remain equal-priority surfaces.
- **Desktop/native strategy:** none for the first version; use browser/PWA installation instead of store distribution.
- **Why this fits the product:** it uses the already-paid Railway platform, supports cloud synchronization and relational date-range calculations, keeps initial provider cost predictable, and avoids native mobile deployment.
- **What would change the recommendation:** a hard offline requirement, Railway cost becoming excessive, a need for managed authentication/storage that outweighs control, strict data residency requirements, or mobile performance evidence showing the bundle is too heavy.

## Component standard

- **Prefer the selected component library for:** forms, buttons, dialogs, tables, menus, notifications, date inputs, responsive layout primitives, and accessible focus management.
- **Build custom components only when:** the payment calendar/status view, receipt preview, or domain-specific report cannot be represented clearly by library primitives.
- **Custom components must preserve:**
  - semantic HTML and keyboard behavior;
  - the project's design tokens;
  - documented anatomy, variants, sizes, and all states;
  - the accessibility target;
  - responsive behavior and content rules.
- **Components rejected or deferred:** native mobile applications; custom design-system primitives before the prepared library is evaluated; realtime features beyond cross-device data consistency.

## Open TBDs

- Select the specific component library after comparing accessibility, mobile performance, bundle size, and licensing.
- Confirm Railway service sizing, PostgreSQL backup/retention, and deployment environments.
- Define authentication method for the single administrator.
- Select the TypeScript API framework and deployment contract.
- Select the specific component library after comparing accessibility, mobile performance, bundle size, and licensing.
- Decide whether the PWA requires push notifications in a later phase.
- Decide whether native `.xlsx` export is required or CSV compatibility is sufficient.

## Approval

- **Status:** `approved`
- **Approved by:** User
- **Date:** 2026-09-29
