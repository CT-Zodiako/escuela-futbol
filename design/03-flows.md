# Phase 3 — Core flows

## Key tasks (priority order)

1. Sign in — administrator — protect all student and payment information.
2. Register a student — administrator — create an active student with a billing start month.
3. Register a monthly payment — administrator — record one complete payment for one student and month.
4. Consult pending payments — administrator — identify paid and unpaid students by month.
5. Consult payment history — administrator — inspect a student's payments and a selected date range.
6. Generate a receipt — administrator — create a receipt-like document for a payment.
7. View reports — administrator — see totals and counts by month or selected date range.
8. Export information — administrator — export records to Excel-compatible CSV and/or Excel.

The system is used daily. Operations are individual per student; bulk payment operations are out of scope for now.

## Flows

### Flow: Sign in

**Entry point:** application URL or installed PWA shortcut.

**Steps:**
1. Login screen → administrator enters credentials → system validates them.
2. Valid credentials → system opens the general dashboard.
3. Invalid credentials → clear alert explains that access was not granted without exposing sensitive details.

**Success state:** authenticated administrator session and visible dashboard.

**Error/edge cases:** invalid credentials, expired session, temporary connection loss. Preserve no sensitive data in alerts.

**Max steps target:** one form submission.

### Flow: General dashboard

**Entry point:** successful login.

**Steps:**
1. Dashboard → administrator sees clear access cards/actions for students, payments, pending payments, history, receipts, reports, and exports.
2. Administrator selects one function → system opens the relevant screen.

**Success state:** every primary function is reachable without complicated navigation.

**Error/edge cases:** no students shows an empty state: “Todavía no hay estudiantes registrados.” with “Registrar primer estudiante”.

### Flow: Register a student

**Entry point:** dashboard or students screen.

**Steps:**
1. Select “Registrar estudiante”.
2. Enter name (required), document (optional), and phone (optional).
3. Confirm save → system creates an active student and starts monthly obligations from the registration month onward.

**Success state:** student appears in the individual student list and can receive a payment.

**Error/edge cases:** missing name blocks save with a clear field-level message; connection loss preserves form values and offers retry; destructive cancellation asks for confirmation only when data changed.

**Max steps target:** three steps.

### Flow: Register a monthly payment

**Entry point:** dashboard payment action, student detail, or pending-payment list.

**Steps:**
1. Search/select one student.
2. Enter the received amount, confirm the payment date, choose payment method (cash by default), and optionally add a free-text observation.
3. Save → API validates and records the payment.

**Success state:** the payment appears in the student's history with its date, amount, and observation; receipt action becomes available.

**Error/edge cases:**

- negative or zero values are rejected with a clear message such as “No puede ingresar un valor negativo”;
- the amount may vary and is entered per payment;
- multiple payments are allowed for the same student and month; there is no covered-month field or duplicate blocking (revised 2026-09-29 — previously exactly one payment per student/month was enforced with a required covered-month selector);
- late or advance payments are described using the optional observation field;
- connection loss preserves entered data and offers retry; operation is not confirmed until saved server-side.

**Max steps target:** three steps.

### Flow: Consult pending payments

**Entry point:** dashboard or payments navigation.

**Steps:**
1. Select a month.
2. System displays paid and pending students with clear status labels.
3. Select a student → open individual payment detail.

**Success state:** administrator can identify who paid and who remains pending.

**Error/edge cases:** no payment records in the selected period shows “No hay pagos registrados en este período.” with an action to change the date range or return to the dashboard.

**Max steps target:** two steps to the list.

### Flow: Consult payment history

**Entry point:** student search, dashboard, or reports.

**Steps:**
1. Search by student name, document, or phone.
2. Open one student.
3. View payment history by month and choose a start/end date when needed.

**Success state:** history clearly distinguishes payment date from the month covered and preserves inactive-period history.

**Error/edge cases:** inactive students remain searchable; reactivation starts obligations only from the activation month; no results uses a clear empty state.

**Max steps target:** two steps to search/open; date filtering may add one control action.

### Flow: Generate a receipt

**Entry point:** successful payment or payment history.

**Steps:**
1. Select a payment and choose “Generar recibo”.
2. System creates a receipt-like view/document with student, payment date, amount, method, and observation (if any).
3. Administrator downloads/shares it manually through the device's available share flow, including WhatsApp if available.

**Success state:** receipt is readable on PC and mobile and can be shared without WhatsApp automation.

**Error/edge cases:** receipt generation failure shows a dismissible alert and leaves the payment intact.

**Max steps target:** three steps.

### Flow: View reports

**Entry point:** dashboard or reports navigation.

**Steps:**
1. Select a month or enter a start and end date.
2. System calculates expected, collected, and missing totals plus paid and pending counts.
3. Administrator may open supporting student/payment details.

**Success state:** report results are understandable without editing formulas; averages are not shown.

**Error/edge cases:** invalid date range is rejected with a clear correction message; empty period state is explicit.

### Flow: Export information

**Entry point:** dashboard or reports navigation.

**Steps:**
1. Select export scope: month or date range and desired data set.
2. Select CSV or Excel-compatible output when available.
3. System generates a download with clear date and currency formatting.

**Success state:** administrator downloads a usable file for further analysis or backup.

**Error/edge cases:** no matching records shows the period empty state; export failure leaves source records unchanged and offers retry.

## Shared interaction rules

- Every destructive action requires confirmation.
- Alerts are clear, dismissible, and remain visible for approximately five seconds unless dismissed earlier.
- Validation messages explain the action required, not just that an error occurred.
- Forms preserve entered values after transient connection failure.
- Data is not presented as saved until the server confirms persistence.
- Operations remain individual; no bulk payment marking is included in this version.

## Screen inventory

| Screen | Interface | Purpose | Main components | Flows |
| --- | --- | --- | --- | --- |
| Login | Form | Authenticate administrator | Text inputs, password input, submit, alert | Sign in |
| Dashboard | Navigation panel | Reach all functions | Access cards, summary links, alerts | Dashboard |
| Students | Searchable list | Find, register, activate, or deactivate students | Search, list/table, primary action, status | Register, history |
| Student detail | Detail view/modal | View student data and history | Student fields, payment history, actions | Payment, history, receipt |
| Payment form | Form/modal | Record one payment for one month | Student selector, month, date, amount, method | Register payment |
| Pending payments | Filtered list | Show paid/pending people per month | Month selector, status legend, list | Consult pending |
| Reports | Filtered report | Show totals and counts | Date range, summary cards, supporting list | View reports |
| Receipt | Preview/document | Generate readable payment proof | Receipt content, download/share action | Generate receipt |
| Export | Form/modal | Select scope and format | Date range, dataset, format, download | Export |
| Alert/notification layer | Shared overlay | Explain validation, connection, success, and errors | Dismissible timed alert | All flows |
