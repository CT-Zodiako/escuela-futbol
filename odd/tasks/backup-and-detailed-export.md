# Backup database and detailed payment export

## Goal
Add a way for operators to create a local backup of the SQLite database and export a row-by-row Excel file with every student-payment record.

## Scope
- Add a "Copia de seguridad" tab in Reports (or a backup section) with:
  - A button to download the SQLite database file (`historical.sqlite3`) to the user's Downloads folder.
  - A button to export an `.xlsx` with one row per payment, including full student data.
- Desktop/Tauri only; no web/API changes.

## Proposed Excel columns
- ID del jugador
- Nombre del jugador
- Documento
- Teléfono
- Entrenador (nombre)
- Estado activo
- Mes de activación
- ID del pago
- Fecha de pago
- Valor pagado
- Método de pago
- Concepto
- Observación
- Número de recibo

## Non-goals
- Do not add a file-picker dialog plugin; save to Downloads with a default filename.
- Do not change the existing report exports.
- Do not upload anything to a server.

## Tasks
- [x] Add Tauri command to copy the SQLite database to a default Downloads path. (`55f05cc`)
- [x] Add Tauri command to return all payment records enriched with student/trainer data. (`55f05cc`)
- [x] Add Excel generation and download in the web frontend. (`55f05cc`)
- [x] Add UI tab/buttons in ReportsPage. (`55f05cc`)
- [x] Verify build and close task. (`55f05cc`)
- [x] Publish signed Windows release v0.3.9. (`v0.3.9`, run `37211610217`)

## Constraints
- Preserve local-only architecture.
- Never expose sensitive data outside the local machine.
