# Trainer title case and payment history labels

## Goal
Normalize newly saved trainer names to title case and make report/history action labels explicit.

## Tasks
- [x] Normalize trainer names to title case for online and offline creation.
- [x] Change visible report/history labels to the requested capitalization and wording.
- [x] Run API, frontend, and desktop checks and record the outcome.

## Acceptance criteria
- Names such as `cristian tovar` or `CRISTIAN TOVAR` are stored/displayed as `Cristian Tovar` for online and offline trainer creation.
- The report action says `Generar Reportes`.
- History actions say `Ver Historial Pagos` everywhere in the desktop UI.
- Existing trainer IDs, sync behavior, and data contracts remain compatible.

## Notes
- API creation and the Tauri SQLite outbox are separate write paths and both need normalization.
- This is a follow-up desktop change and must ship in a new release, not overwrite an existing tag.
- Validation: API tests passed (53/53), web build passed, and production-URL desktop build passed. Only the known non-blocking Vite chunk warning remains.
- Delivery: pending the next desktop release; existing v0.2.1 will not be overwritten.
