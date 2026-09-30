# Phase 5 — Components

## Inventory

| Component | Category | Used in screens | Status |
| --- | --- | --- | --- |
| Button | action | Login, Dashboard, Student form, Payment form, Export, Confirmation dialog | approved |
| TextInput | form | Login, Student form, Payment form | approved |
| NumberInput | form | Payment form (amount) | approved |
| Select | form | Payment form (method), Export dialog (format) | approved |
| Textarea | form | Payment form (optional observation) | approved |
| MonthSelector | form | Pending payments, Reports (not the Payment form) | approved |
| DateRangePicker | form | Payment history, Reports, Export | approved |
| StatusBadge | data display | Student list, Payment history, Pending payments | approved |
| SummaryCard | data display | Dashboard, Reports | approved |
| DataTable | data display | Student list, Pending payments, Reports, Payment history | approved |
| SearchBox | form | Student list, Pending payments | approved |
| ReceiptPreview | data display | Receipt | approved |
| Modal | overlay | Student form, Payment form, Export dialog | approved |
| ConfirmationDialog | overlay | Delete/deactivate student, delete payment, discard changes, sign out | approved |
| Alert | feedback | All flows | approved |
| NavigationHeader | navigation | All authenticated screens | approved |
| Icon | data display | Status badges, buttons, navigation | approved |
| EmptyState | feedback | Student list, Pending payments, Reports, Export | approved |

Categories: action · form · feedback · navigation · layout · data display · overlay

---

## Button

Purpose: trigger a primary, secondary, or destructive action.

When NOT to use: for navigation between unrelated screens (use NavigationHeader links instead).

Anatomy:
- label — token: `semantic.typography.body`
- optional leading filled icon — token: `component.control.horizontalPadding`
- container — token: `component.control.radius`, `component.control.minHeight`

Variants: primary | secondary | danger

Sizes: md (default) — min touch target 44x44px per `component.control.minHeight`.

States:

| State | Visual change | Tokens |
| --- | --- | --- |
| default | solid fill for primary; outline for secondary | `semantic.color.action.primary` |
| hover | slightly darker fill/border | `semantic.color.action.primary` |
| focus-visible | visible focus ring, never removed | `semantic.color.action.focus` |
| active/pressed | darker fill, no layout shift | `semantic.color.action.primary` |
| disabled | reduced contrast, not focusable unless `aria-disabled` with a discoverable reason | `semantic.color.content.muted` |
| loading | label replaced by a static "Guardando..." text (no motion; motion is disabled for this product) | `semantic.typography.body` |

Behavior: `Enter`/`Space` activates; disabled buttons that must expose a reason use `aria-disabled` and remain focusable.

Accessibility: role `button`; label is always visible text, never icon-only for primary/destructive actions.

Content rules: verb-first label (e.g. "Guardar", "Eliminar estudiante"); danger buttons always name the destructive action explicitly.

---

## TextInput (baseline for all form fields)

Anatomy: label (always visible, never placeholder-only) · required/optional marker · field · helper text · error message · optional prefix/suffix filled icon.

States: default · hover · focus-visible · filled · disabled · read-only · error · success (optional).

Rules:
- Label above the field; error replaces helper text below the field.
- Error = color + icon + text, never color alone (e.g. "No puede ingresar un valor negativo").
- Placeholder only shows an example format, never instructions.
- Only the student "Nombre" field is required; mark "Documento" and "Teléfono" as optional.

---

## NumberInput (payment amount)

Purpose: capture the exact amount received for one payment.

Anatomy: label · field with `inputmode="numeric"` · currency formatting preview (dot thousands separator, no cents) · error message.

States: default · focus-visible · filled · error (negative or zero value).

Behavior:
- Opens the numeric keyboard automatically on mobile.
- Value is saved only through an explicit "Guardar" button, never on blur/autosave.
- The save button must remain reachable above the mobile keyboard (sticky action area or auto-scroll into view); it must never be covered by the keyboard.
- Rejects zero and negative values with an inline error before submission.

Accessibility: numeric `inputmode` plus explicit label; error announced through the shared error pattern.

---

## MonthSelector

Purpose: choose the calendar month a report or history view refers to (used for Reports and Pending payments, not for the Payment form).

Anatomy: label · month/year control · confirm selection.

*(Revised 2026-09-29: the Payment form no longer uses MonthSelector or enforces one payment per student/month; multiple payments per month are allowed, with an optional Textarea observation field replacing the required covered-month selection. See PaymentForm below.)*

---

## DateRangePicker

Purpose: choose a start and end date for history and reports.

Anatomy: start date field · end date field · apply action.

States: default · focus-visible · error (end date before start date, or invalid range).

Behavior: invalid ranges are rejected with a clear correction message before querying data.

---

## StatusBadge

Purpose: show whether a month/payment is paid or pending, never by color alone.

Anatomy: filled icon + text label + background token.

Variants:

| Status | Token | Icon + text |
| --- | --- | --- |
| Paid | `semantic.color.status.paid` / `paidSurface` | check icon + "Pagado" |
| Pending | `semantic.color.status.pending` / `pendingSurface` | clock icon + "Pendiente" |
| Error/blocked | `semantic.color.status.error` / `errorSurface` | alert icon + explicit reason |

Accessibility: status is conveyed through text, not only color or icon.

---

## SummaryCard

Purpose: display one calculated total or count (collected, expected, missing, paid count, pending count) on the dashboard and reports.

Anatomy: label · value (currency or count formatted per locale) · optional supporting icon.

Content rules: no averages are ever shown here (explicitly out of scope).

---

## DataTable

Purpose: list students, pending payments, payment history, and report rows.

Anatomy: header row (fixed order, no column sorting) · rows · sticky footer with dynamic pagination controls.

Behavior:
- Fixed alphabetical order by student name; no column sorting.
- A single SearchBox filters across every visible column (name, document, phone, status, etc.), not name-only.
- Pagination page size is computed from the available viewport height so the footer/"Siguiente" control is always visible without scrolling.
- Adapts row count on mobile vs. desktop viewports automatically.

States: default · empty (see EmptyState) · filtered-empty (search yields nothing).

---

## SearchBox

Purpose: filter DataTable rows by any visible field.

Anatomy: filled search icon · input · clear action.

Behavior: filters live as the administrator types; matches partial text across all visible columns.

---

## ReceiptPreview

Purpose: present a payment as a readable receipt-like document.

Anatomy: student name · covered month · payment date · amount · payment method · download/share action.

Behavior: downloadable/shareable on PC and mobile through the device's native share/download flow; no WhatsApp automation.

---

## Modal

Purpose: host the Student form and Payment form.

Anatomy: title · content · primary/secondary actions.

Sizes: single adaptive size — full-width/full-height on mobile, centered dialog on desktop; no separate size variants needed.

Behavior: closing with unsaved changes triggers ConfirmationDialog only if data changed.

---

## ConfirmationDialog

Purpose: confirm every destructive action (delete student, delete payment, deactivate student, sign out, discard unsaved changes).

Anatomy: clear description of the consequence · confirm (danger) action · cancel action.

Rules: cancel is the default focused action; confirm always names the action explicitly (e.g. "Eliminar pago").

---

## Alert

Purpose: communicate validation errors, connection issues, and confirmations across all flows.

Anatomy: filled icon · message · dismiss action.

Behavior:
- Auto-dismisses after approximately 5 seconds.
- Can also be dismissed manually at any time before that.
- Message states clearly what happened and, when relevant, what to do (e.g. "No puede ingresar un valor negativo").

---

## NavigationHeader

Purpose: persistent access to the dashboard and primary sections after login.

Anatomy: product name/logo · primary navigation links · sign-out action.

---

## Icon

Style: filled icons, consistent single style across the product (no mixing filled and outline).

Used for: status badges, buttons with a leading icon, alerts, empty states.

---

## EmptyState

Purpose: explain a screen with no data and offer the next action.

Anatomy: message · optional primary action.

Confirmed instances:
- No students: "Todavía no hay estudiantes registrados." + "Registrar primer estudiante".
- No payments in period: "No hay pagos registrados en este período." + change date range / return to dashboard.
