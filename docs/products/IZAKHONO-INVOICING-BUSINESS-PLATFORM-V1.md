# IZAKHONO Invoicing & Business Platform — Product Specification v1

**Status:** Product/architecture specification; implementation not yet deployed  
**Repository:** `bevanshelton-netizen/izakhono-builder`  
**Branch:** `feat/izakhono-invoicing-platform-v1`  
**Product:** IZAKHONO Invoice & Business Desk (working name)

## 1. Product vision

Build an IZAKHONO-owned invoicing and business administration platform inspired by the useful workflows in Invoice Home, but with clearer financial controls, stronger document lifecycle handling, organisation-aware data isolation, and a path to broader business operations.

This is a product within the IZAKHONO ecosystem, not a copy of Invoice Home. Use original IZAKHONO branding, navigation, copy, design and implementation.

## 2. Reference workflow absorbed

The supplied Invoice Home screen demonstrates:
- A document workspace for invoices, tax invoices, proforma invoices, receipts, sales receipts, cash receipts, quotes/estimates, credit memos/credit notes, purchase orders and delivery notes.
- Customer search and customer records.
- A document register with type, number, date, paid amount and total.
- Work queues for all documents, overdue, partially paid, unpaid, paid, emailed and trash.
- Reports and document generation.

Its current account message shows a Free Plan invoicing cap of $100 in the past 30 days. IZAKHONO should avoid a surprise hard stop in the middle of normal business activity: clearly show plan limits, usage and upgrade/export options before a limit is reached. Plan policy and pricing are not yet defined.

The supplied screen's displayed figures are: 25 documents; 11 overdue; 13 unpaid; 12 paid; total R192,250; paid R24,420; balance R167,830. The arithmetic reconciles (total minus paid equals balance). Treat this as an example dashboard snapshot only—not imported, independently verified accounting data. The screen also includes a receipt with R0 paid against a positive total, illustrating why document type and payment status must be handled carefully.

## 3. Product principles

1. **Business-owned records:** every customer, document, payment and report belongs to a workspace/business.
2. **Accurate money:** use decimal/numeric database values and integer minor units in application calculations; never binary floating-point for currency.
3. **Immutable financial history:** issued documents are not silently overwritten. Use revisions, voids, credit notes and audit events.
4. **Clear statuses:** distinguish draft, issued, sent, viewed (when supported), partially paid, paid, overdue, void and archived.
5. **Simple first-use:** create a customer, create a quote/invoice, preview, issue, send/export and record payment with minimal steps.
6. **South African-ready, internationally extensible:** ZAR by default for a South African workspace; configurable currency, locale, tax labels/rates and business details. Do not hard-code VAT assumptions or claim tax compliance until reviewed against current requirements.
7. **Privacy and security by design:** tenant isolation, least privilege, secure file access and audit trail.
8. **No unapproved spending:** do not purchase domains, subscriptions, hosting, payment services or infrastructure without explicit approval.

## 4. Primary navigation

- Overview
- Documents
- Customers
- Products & Services
- Payments
- Reports
- Settings

Global actions: **Create invoice**, **Create quote**, **Add customer**, **Record payment**.

## 5. Dashboard

Show:
- Amount invoiced in the selected period
- Amount collected
- Outstanding receivables
- Overdue receivables
- Draft and awaiting-send documents
- Recent activity
- Aging summary (current, 1–30, 31–60, 61–90, 90+ days)
- Cash/payment trend

Each metric must be calculated from explicitly defined eligible document/payment states. Exclude drafts and void documents from issued revenue/receivables. Make date range and currency visible. Clicking a metric opens the corresponding filtered register.

## 6. Document register and types

Support document type configuration and separate number sequences per workspace/type:
- Invoice / Tax Invoice
- Proforma Invoice
- Quote / Estimate
- Receipt / Sales Receipt / Cash Receipt
- Credit Note / Credit Memo
- Purchase Order
- Delivery Note

Register filters: type, status, customer, date range, due date, amount, overdue, sent channel and search. Provide saved views and bulk actions only where safe.

Numbering must be workspace-scoped, sequential/configurable, collision-safe and auditable. Issued numbers are never reused after voiding. Allow prefix and financial-year patterns, with preview and a warning before changing the sequence.

## 7. Document creation experience

A guided, responsive editor:
1. Select or create customer.
2. Set document type, issue date, due date and currency.
3. Add line items (description, quantity, unit, unit price, discount and tax).
4. Add notes, terms, reference/PO number and optional attachments.
5. Preview a branded document.
6. Save draft, issue, download PDF or send by email.

Include IZAKHONO logo/branding, business identity, customer details, line-item table, subtotal, discounts, tax breakdown, total, amount paid, balance due, payment instructions and document number. Templates must be professional and print-friendly. Do not expose private internal notes in customer-facing PDFs.

## 8. Customer and catalogue records

Customer fields: display/legal name, billing and delivery address, email, phone, tax/VAT identifier (optional), customer code, payment terms, currency preference, notes and active/archive state.

Product/service fields: name, SKU/code, description, unit, default price, currency, tax category/rate, active state. Support one-off custom lines without requiring catalogue creation.

Customer detail page: contact data, all documents, payment history, outstanding balance, activity timeline and statement export.

## 9. Payments and reconciliation

A payment is a separate record, not a value typed directly into an invoice total. Support:
- Manual payment entry (date, amount, method, reference, notes).
- Allocate one payment to one or multiple invoices.
- Multiple payments per invoice.
- Partial payments and overpayment handling (customer credit or unapplied balance, not silent adjustment).
- Reversal/refund entries with reason and audit trail.
- Receipt generation after a payment is recorded.

Payment methods may include EFT/bank transfer, cash, card, payment link and other configurable methods. Integrations are a later phase; do not imply that a payment was received based only on a sent payment link.

## 10. Reports

- Sales/invoiced totals by period, customer and document type
- Receivables and overdue aging
- Customer statements
- Payment collection report
- Tax summary by configured tax category/rate
- Document activity and audit log
- Export CSV/XLSX/PDF where appropriate

Reports must state their date basis (issue date, due date or payment date) and filters. Provide a reconciliation view that explains how total, paid and balance were calculated.

## 11. Suggested data model

All tenant-owned tables include `workspace_id` and enforce access controls:
- `workspaces`, `workspace_members`, `workspace_settings`
- `customers`, `catalog_items`
- `documents`, `document_lines`, `document_events`
- `payments`, `payment_allocations`, `payment_reversals`
- `document_sequences`, `email_delivery_events`, `file_assets`

Core document fields: workspace, type, number, customer, status, issue/due dates, currency, subtotal, discount total, tax total, grand total, amount paid (derived from valid allocations), balance due (derived), terms, customer-visible notes, internal notes, template/version and created/issued timestamps.

Use database constraints for nonnegative quantities/amounts where applicable, valid allocation totals, unique workspace+type+number, and consistent currency. Store immutable issued-document snapshots so later customer/catalogue edits do not alter historical documents.

## 12. Security and audit requirements

- Authentication and workspace membership checks.
- Row-level tenant isolation on all exposed data.
- Role model: Owner, Admin, Finance, Staff, Read-only (permissions configurable).
- Do not trust user-editable profile metadata for authorization.
- No service-role or secret keys in browser code.
- Private document storage with time-limited access links.
- Audit events for issue, send, payment, allocation, void, credit note, settings and numbering changes.
- Validate all monetary calculations on the server/database.
- Rate-limit email/send and document-number issuance.
- Backup, retention and recovery policy to be defined before production launch.

## 13. Technical direction

Use the IZAKHONO Builder repository as the engineering source of truth and integrate with existing IZAKHONO architecture rather than creating an isolated competing platform. Keep the billing product modular and tenant-aware. A candidate web stack is Next.js/TypeScript with a PostgreSQL-backed service and server-side document generation; confirm existing repo conventions and approved runtime before implementation.

Do not bind this product to NODE01 as physical infrastructure. If it uses NODE01, preserve the canonical logical identity `logical_node_id: NODE01`, `identity_type: software-runtime`, and keep the replaceable runtime host separate. Do not alter DNS, live deployments or production infrastructure in this specification stage.

## 14. Delivery phases

### Phase 1 — MVP
Workspace settings, customer directory, catalogue, invoice/quote editor, branded PDF preview/export, document register, manual payment recording, partial payment status, receipt generation, basic dashboard, CSV export and audit log.

### Phase 2 — Operations
Email delivery with delivery history, customer statements, credit notes, purchase orders, delivery notes, aging reports, saved filters, roles and multi-currency support.

### Phase 3 — Integrations
Payment provider checkout/webhooks, bank feed/reconciliation options, accounting exports, recurring invoices, reminders and API access. Integrations require provider selection, security review and explicit cost approval.

### Phase 4 — IZAKHONO Business Desk
Optional modules for expenses, inventory, quotations-to-orders, recurring billing, project/job costing and business analytics. These must not delay the invoicing MVP.

## 15. MVP acceptance criteria

- A user can create a workspace and securely invite a member.
- A user can create a customer and reusable item.
- A user can create, save, preview, issue and export an invoice and quote.
- Issued PDF preserves a snapshot of the customer, items, taxes, totals and terms.
- An invoice can receive multiple partial payments and correctly show paid/balance/status.
- A payment can be allocated across invoices with no double counting.
- A receipt can be generated from a recorded payment.
- Overdue calculations use due date and outstanding balance, not simply document age.
- Workspace A cannot read or modify workspace B's records or files.
- Document numbering is unique and safe under concurrent requests.
- Dashboard totals reconcile to the underlying documents and payment allocations.
- Automated tests cover calculations, status transitions, permissions and numbering.
- No paid service or production deployment occurs without approval.

## 16. Immediate next engineering steps

1. Inspect current application conventions and existing billing-related code in the repository.
2. Create a dedicated app/module and database migration plan.
3. Implement and test money calculations and document lifecycle as domain logic before UI.
4. Build the dashboard/register/editor on top of those tested rules.
5. Review security, tax/document wording and operational readiness before production.
