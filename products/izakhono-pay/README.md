# I-PAY™ by IZAKHONO — Platform V1

**Business payments and merchant management. One brand. One identity. A global ambition.**

I-PAY is the customer-facing brand for the existing IZAKHONO PAY project. The repository, API, payment-intent lifecycle, provider adapters, ledger and reconciliation control plane retain their technical continuity under `products/izakhono-pay`.

## Product direction

- **I-PAY Business** — merchant payments and merchant-management experiences.
- **I-PAY Links** — merchant payment-link experiences, subject to release verification.
- **I-PAY Wallet** — proposed wallet experiences, subject to legal structure, regulatory and partner approvals.
- **I-PAY Global** — international payment ambitions and partner connectivity, activated market by market after approvals.

Product-family names do not imply that every service is operational. Public availability must be verified separately for each experience.

## Commercial direction

The proposed merchant model combines a free entry plan, paid subscriptions and negotiated enterprise pricing. The public website presents indicative planning tariffs only. These are not binding offers or active merchant tariffs until acquiring costs, scheme fees, partner terms, tax treatment, legal review and final commercial approval are complete.

IZAKHONO's owned-first software and infrastructure architecture is a cost and control advantage. It does not eliminate card-scheme, acquiring, banking, settlement, FX, compliance or other external partner costs. The platform should measure cost and contribution by merchant, payment method, provider and country before changing live prices.

## V1 platform capabilities

- Merchant registration and status
- Payment intents and payment links
- Hosted-checkout contract
- Idempotency keys
- Provider adapter contract
- Signed webhook ingestion
- Transaction and event ledger records
- Refund request records
- Settlement and reconciliation records
- Merchant dashboard API
- Sandbox mode

## Payment flow

Merchant → I-PAY API → Payment Intent → Provider Adapter → Verified Webhook → Ledger → Reconciliation → Merchant Experience

I-PAY owns the merchant experience, orchestration logic, transaction records and reconciliation control plane. Regulated partners handle regulated money movement until IZAKHONO is appropriately authorised and the required agreements are in force.

## Security and release boundaries

- Never store PAN/CVV or banking credentials.
- Require idempotency for money-moving commands.
- Verify provider webhooks before state mutation.
- Record provenance and maintain audit trails.
- Keep secrets server-side.
- Separate sandbox from production credentials.
- Do not mark a payment paid based solely on a browser redirect.
- Do not represent a payout as complete without provider/bank confirmation and reconciliation.
- Keep real-money processing fail-closed until all configured live gates and end-to-end acceptance evidence pass.

## Public experience

The root `index.html` is the public I-PAY brand and merchant-plan information site. `public/index.html` is the operations/sandbox presentation surface and `public/mock-checkout.html` is a non-money-moving sandbox checkout. Their actual public routing and API connectivity must be verified against the deployed Worker; the current `wrangler.jsonc` does not declare a static-assets binding. The Wrangler entrypoint is `src/index.ts`, while the package's Node check/test scripts also reference `src/index.js`; these are distinct code paths and must not be treated as one tested runtime. The responsive public website is not proof of a native mobile application or live payment availability.

## Deployment

- Vercel project: `izakhono-pay`
- Project root: `products/izakhono-pay`
- Existing custom domain: `pay.izakhono.africa`
- Worker runtime: Cloudflare Wrangler configuration in `wrangler.jsonc`

Vercel website deployment and Cloudflare Worker deployment are separate release targets. A Vercel website deployment does not deploy the Worker API. Confirm both independently. The public domain, TLS, API routing, Worker health, production database, provider credentials and end-to-end acceptance must be verified before declaring the complete platform live.
