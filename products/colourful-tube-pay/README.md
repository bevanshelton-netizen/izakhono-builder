# COLOURFUL TUBE PAY

Creator-facing financial product for COLOURFUL TUBE, powered by shared IZAKHONO PAY infrastructure.

## Product boundary

- **IZAKHONO PAY** remains the system for provider integrations, payment intents, collection webhooks, settlement and provider reconciliation.
- **COLOURFUL TUBE PAY** owns product-specific creator revenue policies, allocation records, creator earnings ledger, reward programmes, withdrawal requests and creator finance experiences.
- iKhokha is a collection provider candidate. Production credentials, merchant approval, supported use case confirmation and end-to-end verification are prerequisites.
- Payouts are a separate provider capability. No assumption is made that a collection provider can disburse creator funds.
- The platform ledger is an accounting record, not a deposit account, stored-value wallet or representation that funds are held by COLOURFUL TUBE.

## Current build

This first isolated release is a responsive finance-control-centre preview. It uses clearly labelled illustrative figures, local-only navigation and a downloadable sample CSV. It does not connect to payment providers, creator personal information, bank accounts or a production database. No live payments or payouts can be initiated.

## Architecture

`COLOURFUL TUBE → COLOURFUL TUBE PAY → IZAKHONO PAY → approved collection provider`

`COLOURFUL TUBE PAY → creator allocation ledger → separately approved payout provider`

Provider secrets stay server-side. Provider webhook confirmation, payment-status verification, idempotency, append-only financial events and daily reconciliation are mandatory before production use.

## Revenue policy

Revenue shares are configurable contract terms, not hard-coded defaults. Proposed rates from the planning discussion are illustrative only and must not be used to post real creator earnings until approved in signed creator/platform agreements. Each calculation must define distributable revenue, provider fees, refunds, chargebacks, taxes, campaign expenses and timing.

## Local preview

Serve this directory with any static HTTP server, for example:

`python3 -m http.server 4173`

Then open `http://localhost:4173`.

## Deployment

The Vercel project should use this directory as its root, with SSO protection enabled. Preview deployment only until the app has real authentication, backend authorization, provider approval, data retention and security review. No production domain or public finance data should be attached to this demo build.

## Database schema

`schema/001_creator_finance.sql` is a proposed migration for review only. It has not been applied to any Supabase or production database. All tables enable row-level security and have no client policies, so access is denied until an explicit reviewed authorization model is implemented.

## Release gates

1. Approve creator contract and revenue-allocation policy.
2. Confirm legal classification, FICA/POPIA/consumer/tax obligations with qualified South African advisers.
3. Confirm iKhokha merchant approval and exact collection integration contract.
4. Select and approve a separate payout provider and beneficiary verification method.
5. Implement authenticated backend APIs and owner-controlled finance RBAC.
6. Implement transactional double-entry postings, reversals and idempotency.
7. Run provider sandbox, webhook replay, reconciliation and security tests.
8. Complete independent acceptance and owner approval before any live credentials or production cutover.
