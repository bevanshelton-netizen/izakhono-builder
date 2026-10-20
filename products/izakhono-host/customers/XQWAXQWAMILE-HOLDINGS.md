# !XQWAXQWAMILÉ HOLDINGS — IZAKHONO HOST Customer Record

## Purpose

This record prepares the customer for promotion from the current external hosting path to the IZAKHONO-owned hosting runtime. It is an infrastructure handoff record, not proof of public deployment.

## Customer

- Customer: !XQWAXQWAMILÉ HOLDINGS (PTY) LTD
- Primary domain: `xqwaxqwamile.com`
- Secondary domain: `xqwaxqwamile.co.za`
- Website source: `bevanshelton-netizen/Downloads` → `sites/xqwaxqwamile-holdings`
- Site slug: `xqwaxqwamile-holdings`
- Runtime target: IZAKHONO HOST native runtime
- Current external fallback: Vercel

## Provisioning intent

1. Create the owned runtime site record for the site slug.
2. Deploy the approved static website content through the typed content deployment endpoint.
3. Attach both customer domains through the IZAKHONO edge/DNS workflow.
4. Obtain trusted HTTPS through the owned edge/TLS workflow.
5. Keep Vercel as a reversible fallback until owned-host acceptance is complete.
6. Promote the site only after DNS + HTTPS + content acceptance evidence exists.

## Business mailboxes — planned

The customer mail plan remains:

- `info@xqwaxqwamile.co.za`
- `calvin@xqwaxqwamile.co.za`
- `projects@xqwaxqwamile.co.za`
- `diamonds@xqwaxqwamile.co.za`
- `tenders@xqwaxqwamile.co.za`

These are **PLANNED**, not live. No mailbox credential is stored in this record.

## Contact workflow

The source contact endpoint is `POST /api/contact` and routes to IZAKHONO MAIL first when the required server-side transport configuration exists. Resend remains a reversible fallback. The current Vercel production deployment predates the endpoint and therefore returns `404` for `/api/contact` until a fresh deployment is promoted.

## Acceptance gates

| Gate | Status |
|---|---|
| Source locked | VERIFIED |
| Contact API tests | VERIFIED |
| External production website | VERIFIED |
| Owned runtime source | READY FOR ACTIVATION |
| Owned runtime physical activation | PENDING |
| Public DNS delegation to owned edge | PENDING |
| Trusted HTTPS on owned edge | PENDING |
| Owned content acceptance | PENDING |
| IZAKHONO MAIL transport | PENDING |
| Real outbound mail | PENDING |
| Inbound mailbox/MX acceptance | PENDING |

## Safety rule

Do not mark this customer LIVE, ACCEPTED, or FULLY PROVISIONED until the corresponding machine-side and public-side evidence has been recorded. Never commit secrets, mailbox passwords, API tokens, private keys, or SMTP credentials to this repository.

## Promotion order

`SOURCE → OWNED PROVISION → CONTENT → DNS → HTTPS → ACCEPT → MAIL TRANSPORT → REAL MAIL TEST → MAILBOX/MX ACCEPTANCE → CUSTOMER HANDOVER`
