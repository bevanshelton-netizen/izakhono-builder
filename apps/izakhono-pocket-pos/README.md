# IZAKHONO PocketPOS

A mobile-first, installable point-of-sale application designed to turn a supported phone into a merchant sales workstation.

## Functional prototype now included

- product catalogue, search and SKU lookup
- barcode/scanner input
- cart, VAT calculation and quick sale
- branch-aware stock
- multi-branch selection
- customers/CRM
- staff role profiles
- cash and verified-EFT recording
- Tap-on-Phone handoff workflow
- sales history
- shareable receipts using the phone share sheet
- offline PWA shell and install-to-home-screen support

The current branch is still a **prototype**, not evidence of public production availability.

## Production security boundary

PocketPOS does not capture PAN, PIN or CVV. Card-present payments must remain inside an approved Tap-on-Phone / SoftPOS provider. Online card payments must be implemented via the backend using a supported payment API and verified provider webhooks.

Local staff profiles in the prototype are not production authentication. The production design requires server-side password/PIN hashing, role enforcement, short-lived sessions, device enrolment, audit logs, merchant/branch isolation and payment reconciliation.

See `schema.sql` and `API-CONTRACT.md` for the next-stage backend design.
