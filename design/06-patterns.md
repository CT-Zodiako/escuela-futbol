# Phase 6 — Patterns

## Forms and inputs

- Layout: single column, comfortable spacing (`semantic.layout.sectionGap`).
- Validation timing: **live while typing** (format, negative/zero values) **and again on save** (required fields, empty fields, business rules such as a duplicate monthly payment). Goal: prevent bad data from ever reaching persistence.
- Error message format: "{What is wrong}." e.g. "No puede ingresar un valor negativo."
- Save is always explicit through a "Guardar" button; never autosave.
- Submit button: disabled only while saving (show "Guardando..." text, no motion), not for invalid forms — invalid forms show inline errors instead.
- On save error: focus the first invalid field; show a summary alert if more than 3 fields fail.
- Unsaved changes: tracked only when the current value differs from the original value, not merely when a field was touched/focused.
- Discarding a form with real unsaved changes requires confirmation (ConfirmationDialog); discarding an untouched or reverted-to-original form does not.

## Feedback

| Situation | Pattern | Duration |
| --- | --- | --- |
| Action succeeded | Alert (success color/icon) | auto-dismiss ~5s, manually dismissible |
| Action failed / validation error | Alert (error color/icon) | auto-dismiss ~5s, manually dismissible |
| Destructive action | ConfirmationDialog | until answered |
| Connection lost mid-action | Alert explaining the issue; entered data preserved; retry offered | auto-dismiss ~5s, manually dismissible |

Success and error share the same Alert component; only color, icon, and message change (see `semantic.color.status.paid` vs `error` tokens).

## Empty, loading, and error states

Every list/data screen defines an empty state with a next action (see `05-components.md` EmptyState). Confirmed states:

- No students registered: "Todavía no hay estudiantes registrados." + "Registrar primer estudiante".
- No payments in the selected period: "No hay pagos registrados en este período." + change date range / return to dashboard.

Loading feedback stays minimal given this product has no motion: show a static "Cargando..." label for operations that take a noticeable time; no spinner animation.

Connection-loss error: keep form values intact, show a dismissible alert, and allow retry. Data is never presented as saved until the server confirms persistence.

## Layout

- Grid/columns per breakpoint: adaptive, single-column forms; tables/report cards reflow between a single column on mobile and a multi-column layout on desktop.
- Max content width: none fixed beyond what keeps tables and forms readable; content uses available width with `semantic.layout.pagePadding` on each side.
- Page spacing: `semantic.layout.pagePadding` (24px) around page content; `semantic.layout.sectionGap` (24px) between sections; `semantic.layout.controlGap` (12px) between related controls.

## Export scope

- Exported CSV/Excel files list only **completed payments** for the selected month or date range — pending/unpaid months are not enumerated as export rows.
- On-screen pending-payments consultation and report summary totals (expected, collected, missing, paid count, pending count) are unaffected by this rule; they continue to reflect both paid and pending students.

## Receipt output

- The receipt (`ReceiptPreview`) supports:
  - a print-friendly layout usable directly from the browser;
  - a downloadable image (e.g. PNG) generated from the receipt content, sized for easy sharing through the device's native share flow, including WhatsApp, without any WhatsApp automation.

## Content and voice

- Tone: clear, direct, professional; matches the "serious and professional" visual personality (K2).
- Casing: sentence case for labels and buttons.
- Buttons use verbs: "Guardar", "Eliminar estudiante", not "Aceptar" alone.
- Currency displayed with dot thousands separators and no cents (e.g. `$150.000`); dates in `DD/MM/AAAA`.

## Accessibility

- Target: WCAG 2.2 AA.
- Text contrast >= 4.5:1; UI/borders >= 3:1.
- Minimum interactive target size: 44x44px (`component.control.minHeight`).
- Every action reachable by keyboard; logical tab order.
- Focus visible at all times (`semantic.color.action.focus`), never removed.
- No motion is used in this product (K6), so reduced-motion handling is inherently satisfied; loading states use static text instead of animated indicators.
- Status is always conveyed through text and icon, never color alone (StatusBadge, Alert).
