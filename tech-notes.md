# Technical Notes — Escuela Futbol

Confirmed implementation direction, kept separate from the technology-agnostic design phases.

## Approved

- Product delivery: adaptive web application with PWA installation.
- Frontend: React + TypeScript + Vite.
- Backend: TypeScript API service; framework to be selected during implementation.
- Database: PostgreSQL hosted on Railway.
- Hosting: Railway for the frontend service, API service, and database where practical.
- Connectivity: online-first; no offline mode in the first version.
- Distribution: browser and PWA installation; no Play Store deployment.
- Responsive strategy: PC and mobile have equal priority.

## Still to decide during implementation planning

- API framework.
- Component library.
- Authentication method for the single administrator.
- Railway service sizing, environment separation, backup, and retention policy.
- Export implementation: CSV only or CSV plus native `.xlsx`.
