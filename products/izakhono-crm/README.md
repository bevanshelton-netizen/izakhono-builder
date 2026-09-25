# IZAKHONO CRM

Portfolio-wide customer relationship, pipeline and staff operations engine for IZAKHONO platforms.

## Current release: v0.2.0

The owned operations release adds:

- scoped staff roles: owner, admin, manager, agent, viewer and integration
- legal-entity + platform scope enforcement on every staff identity
- configurable persistent pipelines with deal-stage validation
- deterministic automation rules for intake, deal creation, stage changes and activities
- internal integration outbox for reliable platform hand-off
- venture-scoped audit records for administrative and automation actions
- fail-closed NODE01 production configuration
- owner break-glass administration through CRM_ADMIN_TOKEN

The engine remains dependency-light and deploys on IZAKHONO-owned NODE01 through the existing APP FABRIC runtime. No third-party CRM or identity provider is required.

## Architecture

```text
IZAKHONO platform / internal adapter
        |
        v
APP FABRIC -> CRM intake API
        |
        +-> Contact / organisation
        +-> Deal / opportunity
        +-> Activity / next action
        +-> Pipeline
        +-> Automation rules
        +-> Integration outbox
        +-> Audit trail
        |
        v
NODE01 private network -> FORTRESS / Access -> EDGE / TLS
```

Every business record is scoped by both `entity_id` and `platform_id`. Cross-entity aggregation is denied by default.

## Staff access

Production staff identities are supplied with `CRM_STAFF_JSON` or `CRM_STAFF_FILE`. Tokens should be stored as SHA-256 hashes in the staff configuration.

Example roles:

- `owner`: all scopes and capabilities
- `admin`: full CRM operations, audit and export
- `manager`: contacts, deals, activities, pipelines, automations and integrations
- `agent`: contacts, deals and activities
- `viewer`: read-only CRM access
- `integration`: platform intake only

Each staff record contains explicit entity/platform scopes. A staff token that is valid for FAISReady cannot access KORA unless KORA is separately granted.

`CRM_ADMIN_TOKEN` remains the owner break-glass credential. `CRM_INGEST_TOKEN` remains the internal platform-adapter credential.

Production sets `CRM_ALLOW_INSECURE_LOCAL=false`.

## Main API routes

All scoped routes require:

- `X-Entity-ID`
- `X-Platform-ID`

Routes:

- `GET /health`
- `GET /api/me`
- `GET /api/summary`
- `GET|POST /api/contacts`
- `GET|POST /api/deals`
- `PATCH /api/deals/:id`
- `GET|POST /api/activities`
- `GET|PUT /api/pipeline`
- `GET|POST /api/automations`
- `PATCH /api/automations/:id`
- `GET /api/integrations/outbox`
- `POST /api/integrations/outbox/:id/ack`
- `GET /api/insights`
- `POST /api/intake`
- `GET /api/audit`
- `GET /api/export`

## Automation actions

v0.2.0 supports deterministic internal actions:

- create an activity
- set a deal next action
- set a deal owner
- add a contact tag

Automations do not silently send messages, move money or call unapproved external systems. Platform integrations consume the internal outbox and acknowledge events after their own authorised work completes.

## Privacy boundaries

- ECD360: CRM may store adult learner prospects, centre contacts and funder/employer contacts. It must not duplicate child profiles, classroom records, payroll or protected learner evidence.
- WorkNow: CRM is for employer, recruiter, government and institutional commercial relationships. Jobseeker CV/profile data stays inside WorkNow unless a separately approved data flow is implemented.
- FORTRESS / financial-service work: CRM tracks institutional sales and partner relationships. It is not a fraud-decision store and must not hold banking credentials or transaction secrets.
- Every operating company keeps its own customer, accounting and legal boundary.

## Owned runtime

The production path is:

`NODE01 -> private CRM container -> APP FABRIC -> FORTRESS / Access -> EDGE / TLS`

Build and test:

```bash
cd products/izakhono-crm
npm run check
npm test
docker build -t izakhono/crm:0.2.0 .
```

The APP FABRIC compose package injects `CRM_STAFF_JSON` from the owner-controlled runtime environment and disables insecure local fallback.

Do not expose port 8080 directly to the public internet.

## Status

The v0.2.0 package is ready for NODE01 activation after CI passes. It is not called public-live until NODE01 health, data persistence, role isolation, backup/restore, FORTRESS/EDGE routing and independent HTTPS verification pass.

External infrastructure remains optional and reversible; it is not required for the internal CRM administration engine.
