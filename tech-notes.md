# Technical Notes — Escuela Futbol

Confirmed implementation direction, kept separate from the technology-agnostic design phases.

## Approved

- Product delivery: local-only desktop application; there is no public web release.
- Frontend: React + TypeScript + Vite, maintained solely as the source bundled inside the Tauri desktop shell (`apps/web` is never deployed as a standalone site).
- Backend: local Rust/Tauri commands in the desktop shell; no hosted API service.
- Database: local SQLite on the production Windows machine is the sole production store (administrator authentication, trainers, students, payments, reports, receipt numbering).
- Connectivity: fully local; the product does not require internet for operation. Internet is needed only for the WebView2 installer bootstrap and signed in-app updates.
- Distribution: a single Windows x64 NSIS installer built in GitHub Actions, plus the macOS `.app` for development; no Play Store deployment.
- Receipt sharing: WhatsApp sharing remains supported from the desktop app (receipt image copied to the clipboard, WhatsApp opened with a prefilled message).
- Responsive strategy: PC and mobile have equal priority (mobile use is through the desktop machine's workflows, not a hosted web app).

## Superseded directions

- The earlier Railway-hosted web/PWA direction (Phase 2) was retired in favor of the local-only desktop product. Railway deployment automation and IaC were removed from the repository; decommissioning of the remaining remote Railway resources is a separate final task requiring explicit confirmation.

## Still to decide during implementation planning

- Component library refinements.
- SQLite backup/restore workflow on the production Windows machine.
- Desktop packaging targets beyond Windows x64 and macOS development builds.
- Export implementation: CSV only or CSV plus native `.xlsx`.
