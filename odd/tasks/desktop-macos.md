# Desktop macOS foundation

> **Superseded:** the "preserving the existing web/PWA deployment" scope below reflects the
> original milestone. The product is now local-only desktop; `apps/web` remains only as the
> Tauri-embedded frontend and there is no public web release. Historical evidence is preserved.

## Goal
Create a lightweight macOS desktop shell for Escuela Futbol using Tauri while preserving the existing web/PWA deployment.

## Scope
- Add a standalone desktop package that bundles the existing React web build.
- Add development/build scripts and document macOS prerequisites.
- Keep SQLite/offline synchronization out of this first milestone; define it as the next milestone.
- Do not change production API behavior beyond desktop-origin compatibility if required.

## Tasks
- [x] Amend technical notes to record the approved desktop foundation and deferred offline sync.
- [x] Add the standalone Tauri desktop shell and scripts for macOS.
- [x] Verify web build remains healthy and desktop configuration is structurally valid.
- [x] Remember the administrator email locally and enable the browser/macOS password manager without storing a plaintext password.
- [x] Restyle the receipt as the Club Deportivo Napoli F.C. `COMPROBANTE DE INGRESO` form with letter-sized print layout (web only; no API/database changes).
- [x] Add a required, manually entered receipt number that is immutable after payment creation.
- [x] Add WhatsApp share button in ReceiptModal: generates/downloads a PDF (html2canvas-pro + jsPDF) and opens WhatsApp with a prefilled Spanish message (wa.me with 57 prefix for 10-digit phones); the user attaches the PDF manually. No API/database changes.
- [x] Harden WhatsApp sharing for the packaged Tauri app: save the PDF to Downloads with `tauri-plugin-fs`, open WhatsApp with `tauri-plugin-opener`, least-privilege `capabilities/default.json`, and a shared guard against concurrent share/download.

## Acceptance criteria
- Existing web build remains unchanged and succeeds.
- Desktop package has a clear macOS development/build path.
- Desktop shell can load the built web app and target the configured API.
- SQLite and sync are explicitly deferred rather than partially implemented.

## Evidence
- `pnpm install --frozen-lockfile` passed.
- `pnpm build:web` passed.
- `pnpm build:desktop` passed and produced `apps/desktop/src-tauri/target/release/bundle/macos/Escuela Futbol.app`.
- DMG packaging is deferred; the first milestone targets the macOS `.app` bundle only.
- The rebuilt app was opened with the Railway API URL embedded.
- Local API CORS now allows `tauri://localhost` and `http://tauri.localhost`; production deployment completed and live preflight verified.
- `pnpm build:web` passed after the receipt redesign (ReceiptModal.tsx, print.css, public/napoli-logo.png).
- API tests/build and web build passed after adding receipt numbers; Railway API migration deployed; macOS app rebuilt and launched.
- Web build passed after adding semantic Tabler icons and clearer button variants across dashboard, reports, pending, history, forms, receipt, and login; macOS app rebuilt and launched.
