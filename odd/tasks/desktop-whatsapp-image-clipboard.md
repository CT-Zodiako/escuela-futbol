# Desktop WhatsApp image sharing

## Goal
Share receipt images from the desktop app through WhatsApp and place the image in the system clipboard so the user can paste it into the opened chat.

## Tasks
- [x] Render the receipt as PNG and copy it to the clipboard instead of creating a PDF.
- [x] Open WhatsApp with the receipt message and explain the paste action.
- [x] Run desktop/web checks and record the outcome.

## Acceptance criteria
- Desktop WhatsApp sharing does not generate or refer to a PDF.
- A PNG receipt is written to the clipboard before WhatsApp opens.
- The WhatsApp message remains prefilled and tells the user to paste the image.
- If clipboard APIs are unavailable, the user receives an actionable error rather than a false success.

## Notes
- `apps/web/src/components/ReceiptModal.tsx` already renders the receipt with html2canvas-pro.
- Desktop is the product; the React web package is only its embedded frontend.
- Validation: `pnpm build:web` and `VITE_API_URL=https://api-production-28e26.up.railway.app pnpm build:desktop` passed. Manual paste into WhatsApp remains pending.
- The `VITE_API_URL` injection was later removed; desktop builds are fully local. WhatsApp sharing remains supported.
- Delivery: no commit created because the user did not explicitly request one.
