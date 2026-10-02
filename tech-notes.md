# Technical Notes — Escuela Futbol

Confirmed implementation direction, kept separate from the technology-agnostic design phases.

## Approved

- Product delivery: adaptive web application with PWA installation.
- Frontend: React + TypeScript + Vite.
- Backend: TypeScript API service; framework to be selected during implementation.
- Database: PostgreSQL hosted on Railway.
- Hosting: Railway for the frontend service, API service, and database where practical.
- Connectivity: online-first for the current release; offline mode is deferred to a dedicated SQLite synchronization milestone.
- Distribution: browser, PWA installation, and a lightweight Tauri desktop shell, starting with macOS; no Play Store deployment.
- Responsive strategy: PC and mobile have equal priority.

## Still to decide during implementation planning

- API framework.
- Component library.
- Authentication method for the single administrator.
- Railway service sizing, environment separation, backup, and retention policy.
- Desktop packaging targets beyond macOS, including 32-bit support.
- SQLite local schema, outbox synchronization, conflict policy, and backup/restore workflow.
- Export implementation: CSV only or CSV plus native `.xlsx`.
