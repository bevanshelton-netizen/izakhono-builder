# IZAKHONO FINANCE CORE

Independent, white-label financial-institution operating engine for IZAKHONO.

## Scope

FINANCE CORE is designed for lenders, MFIs, SACCOs/co-operatives, fintechs and other authorised financial institutions. The first package includes:

- loan application and servicing records;
- member/account administration;
- payment-reference intake;
- institution/entity-scoped summaries and audit;
- encrypted local persistence for the owned-engine package;
- integration contracts for FORTRESS, SUPER ACCOUNTANT, IZAKHONO CRM, FLOWIQ, IZAKHONO PAY and IZAKHONO SUPER AI;
- a SUPER APP module at `/finance-core`.

## Safety and regulatory boundary

The engine is a software platform by default. It does **not** enable IZAKHONO itself to accept deposits, extend regulated credit as principal, make final automated credit decisions or move money. Those capabilities remain gated until the operating institution, jurisdiction, licensing/authorisations and controls are verified.

## Runtime

Required for any persisted non-local run:

- `FINANCE_DATA_KEY_B64` — exactly 32 random bytes encoded as base64.
- `FINANCE_ADMIN_TOKEN` — owner/administrator bearer token.
- `FINANCE_INGEST_TOKEN` — integration bearer token.
- `FINANCE_ALLOW_INSECURE_LOCAL=false` in production.

Every scoped API request also requires:

- `X-Institution-ID`
- `X-Entity-ID`

The packaged encrypted file store is suitable for controlled alpha/rehearsal. A production financial-data launch still requires hardened database/KMS, backup/restore proof, security review and jurisdiction-specific compliance sign-off.

## Routes

- `GET /health`
- `GET /api/capabilities`
- `POST/GET /api/loan-applications`
- `POST/GET /api/accounts`
- `POST /api/payments/reference`
- `GET /api/summary`
- `GET /api/audit`

## Deployment status

Owned package target: NODE01. Public-live status is **not yet verified**. External routes, when used, remain resilience routes only and never become the system of record.
