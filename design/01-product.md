# Phase 1 — Product

## Product

**Escuela Futbol** is an adaptive payment-management system for a football school. It replaces a fragile spreadsheet workflow with a simple interface for registering students, recording monthly payments, reviewing payment status, generating receipts, and exporting records.

## Users and context

- **User:** one administrator.
- **Usage context:** the administrator may sit with a laptop or bring a phone to the field during training sessions.
- **Frequency:** expected during training/payment moments and for later administrative review.
- **Devices:** PC and mobile have equal priority; the interface must be adaptive.
- **Technical level:** basic. The UI must use large, visible text, clear form and button labels, and intuitive navigation.
- **Language and locale:** Spanish; dates in `DD/MM/YYYY`; Colombian pesos (COP), without cents and with dot thousands separators; Bogotá timezone.
- **Connectivity:** internet is expected to be available for now.
- **Current workflow:** Excel, with data entered column by column. Formula editing or accidental deletion causes confusion and calculation errors.

## Success criteria

The system succeeds when the administrator can:

- register a new student and add future monthly obligations without ambiguity;
- record a payment in a few intuitive steps;
- search a student and immediately understand whether each month is paid or pending;
- review paid and pending people month by month or across a chosen date range;
- see collected, expected, and missing totals without editing formulas;
- review a student's payment history;
- generate a receipt-like document on PC and share it manually through WhatsApp;
- export records to Excel-compatible CSV or Excel format;
- work without friction on both PC and mobile.

## Domain model and UI-relevant rules

### Student

- Fields: name, document, phone.
- Name is required; document and phone are optional.
- A student can be **active** or **inactive**.
- Deactivation stops new monthly obligations and preserves all history.
- Reactivation resumes obligations from the activation month onward; previous inactive months are not charged.
- Maximum expected volume: 200 active students for now.

### Monthly obligation

- Each active student has a monthly obligation starting from the month in which the student is registered or reactivated.
- The obligation is pending from the first day through the last day of its calendar month until a payment is recorded.
- No months before registration or reactivation are charged.
- The administrator must be able to review obligations month by month and over a selected date range.

### Payment

- The administrator enters the actual amount received; the amount may vary per payment. It is not a global fixed value.
- The payment date is essential.
- A payment carries an optional free-text observation (e.g. "pago adelantado, incluye octubre y noviembre") instead of a required, structured covered-month selector.
- A student may have more than one payment recorded on/around the same date or month; there is no uniqueness restriction between a student and a specific month. *(Revised 2026-09-29: an earlier decision required exactly one payment per student per month with a required covered-month field; the administrator asked to remove that field and allow multiple payments for the same month, using the observation field for any needed context.)*
- Default payment method: cash (efectivo); the method should remain editable if other methods are introduced.
- Existing payments can be edited.
- Existing payments can be deleted only after an explicit confirmation.

### Reports and calculations

The system calculates and displays:

- total collected;
- total expected;
- total missing;
- count of students who paid;
- count of students pending;
- paid and pending people for each month;
- payment history per student;
- month-by-month results and results for an administrator-selected date range.

Averages are explicitly out of scope.

### Exports and receipts

- Export payment and student information to Excel-compatible CSV and/or Excel format.
- Generate a receipt-like document for a payment on PC and mobile.
- Sharing through WhatsApp is manual (for example, using the device's share/download flow); no WhatsApp automation is required.
- Importing the existing Excel data is out of scope.

## Open TBDs

- Product naming convention and brand identity beyond the name Escuela Futbol.
- Whether the system is a web app, installable app, or another delivery shape (Phase 2).
- Whether payment status is tracked per calendar month only or also by custom due date (current direction: calendar month).
- Exact receipt fields, numbering, legal invoice requirements, and output format.
- Supported payment methods beyond the default cash option.
- Account/authentication and synchronization model between PC and mobile.
- Backup, recovery, and data retention policy.
- Whether export must produce native `.xlsx` in addition to CSV.

## Consistency notes

- Variable payment amounts are compatible with monthly paid/pending status because the amount received is stored independently from the obligation status.
- Late or advance payments are described with the free-text observation field rather than a required structured month, since multiple payments per student/month are now allowed.
- Deactivation/reactivation prevents retroactive charges while preserving history.
- Because internet is currently expected, cross-device synchronization can be addressed in the technology phase; offline behavior is not yet a requirement.
