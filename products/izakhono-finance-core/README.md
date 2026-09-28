# IZAKHONO FINANCE CORE

## v0.3 operating MVP

FINANCE CORE now moves beyond the hardened platform shell into an operational institutional MVP. Authorised institutions can configure their white-label profile and loan products, record applications without automated final credit decisions, create maker/checker-approved servicing records, generate repayment schedules, allocate verified external payment references, view arrears and open manual collections cases. FINANCE CORE still does not disburse funds, accept deposits, make final credit decisions or automate customer collections by default.

Independent, white-label financial-institution operating engine for IZAKHONO.

## v0.2 hardening retained

FINANCE CORE now carries the first NODE01 hardening layer:

- institution + legal-entity isolation on every scoped request;
- AES-256-GCM encrypted persistence;
- environment or secret-file key loading;
- distinct maker/checker principals for protected actions;
- maker-checker approval records that prevent the requester approving their own action;
- hash-chained audit records with integrity verification;
- idempotent payment-reference ingestion;
- encrypted backup files with SHA-256 manifests;
- restore checksum verification plus a pre-restore safety copy;
- NODE01 Docker Compose pack bound to loopback, with dropped Linux capabilities and no-new-privileges;
- repeatable NODE01 preflight checks.

## Scope

FINANCE CORE is designed for lenders, MFIs, SACCOs/co-operatives, fintechs and other authorised financial institutions. The package includes:

- loan application and servicing records;
- member/account administration;
- payment-reference intake;
- institution/entity-scoped summaries and audit;
- maker-checker approval workflow;
- encrypted local persistence for the owned-engine package;
- integration contracts for FORTRESS, SUPER ACCOUNTANT, IZAKHONO CRM, FLOWIQ, IZAKHONO PAY and IZAKHONO SUPER AI;
- a SUPER APP module at `/finance-core`.

## Safety and regulatory boundary

The engine is a software platform by default. It does **not** enable IZAKHONO itself to accept deposits, extend regulated credit as principal, make final automated credit decisions or move money. Those capabilities remain gated until the operating institution, jurisdiction, licensing/authorisations and controls are verified.

An approved software account record is not, by itself, authority to accept deposits or operate a regulated financial account.

## Runtime

Required for production-style operation:

- `FINANCE_DATA_KEY_B64` **or** `FINANCE_DATA_KEY_FILE` containing exactly 32 random bytes encoded as base64;
- `FINANCE_ADMIN_TOKEN`;
- `FINANCE_INGEST_TOKEN`;
- `FINANCE_MAKER_TOKENS_JSON`;
- `FINANCE_CHECKER_TOKENS_JSON`;
- `FINANCE_ALLOW_INSECURE_LOCAL=false`.

Maker and checker actor IDs must be distinct.

Every scoped API request also requires:

- `X-Institution-ID`
- `X-Entity-ID`

## Routes

- `GET /health`
- `GET /api/capabilities`
- `POST/GET /api/institution-configs`
- `POST /api/institution-configs/:id/publish`
- `POST/GET /api/product-configs`
- `POST /api/product-configs/:id/publish`
- `POST/GET /api/loan-applications`
- `POST/GET /api/servicing-loans`
- `GET /api/servicing-loans/:id`
- `POST /api/servicing-loans/:id/allocate-repayment`
- `GET /api/arrears`
- `POST/GET /api/collection-cases`
- `POST/GET /api/accounts`
- `POST /api/accounts/:id/activate-record`
- `POST /api/payments/reference`
- `POST /api/approvals/request`
- `POST /api/approvals/:id/approve`
- `POST /api/approvals/:id/reject`
- `GET /api/approvals`
- `GET /api/summary`
- `GET /api/audit`
- `GET /api/audit/integrity`

## NODE01

Use `node01/` for the owned-primary deployment pack and `ops/node01-preflight.mjs` before startup.

Port 8797 is deliberately bound to loopback in the Compose pack. Public traffic must arrive through IZAKHONO EDGE/TLS rather than exposing the engine directly.

## Backup and restore

`ops/backup.mjs` copies the already-encrypted store and creates a SHA-256 manifest.

`ops/restore.mjs` refuses to run unless `FINANCE_RESTORE_APPROVED=YES`, verifies the checksum and makes a safety copy of the current data file when one exists.

These tools are packaged; backup/restore is not considered production-proven until a rehearsal has succeeded on NODE01.

## Deployment status

Owned package target: NODE01. The hardened package is ready for NODE01 activation, but NODE01, backup/restore and public HTTPS evidence are **not yet independently verified**. External routes, when used, remain resilience routes only and never become the system of record.
