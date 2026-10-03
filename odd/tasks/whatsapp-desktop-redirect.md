# WhatsApp Desktop redirect

## Goal
Open the native WhatsApp Desktop application directly from the receipt share action.

## Tasks
- [x] Build a `whatsapp://send` URL with the phone and prefilled message.
- [x] Allow the custom URL through Tauri opener capabilities and preserve clipboard paste flow.
- [x] Run desktop checks and record the outcome.

## Acceptance criteria
- Desktop receipt sharing targets WhatsApp Desktop, not WhatsApp Web or `wa.me` in a browser.
- Phone and message query parameters remain encoded correctly.
- The copied receipt image and paste instructions remain unchanged.
- A clear error is shown if WhatsApp Desktop cannot be opened.

## Notes
- Product decision: native WhatsApp Desktop was selected over WhatsApp Web.
- WhatsApp Desktop must be installed and registered for the `whatsapp://` scheme.
- Validation: web and production-URL desktop builds passed; runtime custom-scheme opening remains to be tested on a machine with WhatsApp Desktop installed.
- Delivery: pending the next desktop release; existing v0.2.1 will not be overwritten.
