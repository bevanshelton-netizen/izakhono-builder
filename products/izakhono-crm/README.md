# IZAKHONO CRM

Portfolio-wide customer relationship and sales pipeline layer for IZAKHONO platforms.

## Goal

Give every customer-facing IZAKHONO platform the same core capabilities without buying a separate CRM for each product:

- customer and prospect records
- platform-specific pipelines and deal stages
- quote / enrolment / subscription / partnership tracking
- tasks, reminders and next actions
- mobile-friendly sales dashboard
- lead-source attribution
- deterministic follow-up insights
- API-based lead intake
- shared reporting with strict entity and platform isolation
- future optional integration with the owner-controlled IZAKHONO AI Gateway

This package is an original IZAKHONO product. It does not copy monday.com branding, source code, protected assets or proprietary workflows.

## Portfolio architecture

Each platform keeps its own customer-facing brand and business workflow. IZAKHONO CRM is the shared administrative relationship engine behind them.

```text
Public platform / enquiry form / checkout / partner form
        |
        v
platform adapter -> IZAKHONO CRM intake API
        |
        +-> Contact
        +-> Deal / opportunity
        +-> Activity / next action
        +-> Dashboard / pipeline
        |
        v
IZAKHONO-owned data boundary -> FORTRESS / Access -> authorised staff
```

Every record is scoped by both `entity_id` and `platform_id`. Cross-entity aggregation is not permitted by default.

## Important privacy boundaries

- ECD360: CRM may store adult learner prospects, centre contacts and funder/employer contacts. It must not become a duplicate store for child profiles, classroom records, payroll or protected learner evidence.
- WorkNow: CRM is for employer, recruiter, government and institutional commercial relationships. Jobseeker CV/profile data remains in the WorkNow product data boundary unless a separately approved data flow is implemented.
- FORTRESS / financial-service work: CRM tracks institutional sales and partner relationships; it is not a fraud-decision store and must not hold banking credentials or transaction secrets.
- Each operating company keeps its own customer, accounting and legal boundary as required by `PORTFOLIO-ENTITY-MAP.md`.

## API

Health:

`GET /health`

Administrative API calls require scope headers:

- `X-Entity-ID`
- `X-Platform-ID`

If `CRM_ADMIN_TOKEN` is configured, administrative API calls also require:

`Authorization: Bearer <token>`

Lead intake can use a separate `CRM_INGEST_TOKEN`.

Main routes:

- `GET /api/summary`
- `GET|POST /api/contacts`
- `GET|POST /api/deals`
- `PATCH /api/deals/:id`
- `GET|POST /api/activities`
- `GET /api/insights`
- `POST /api/intake`
- `GET /api/export`

The first release uses a durable JSON data file so it can run dependency-free on an owner node. Production scale should move the same scoped schema to PostgreSQL / IZAKHONO Core after migration tests pass.

## Local run

```bash
cd products/izakhono-crm
npm test
npm start
```

Default local URL: `http://127.0.0.1:8080`.

For an owner-node container:

```bash
docker build -t izakhono/crm:0.1.0 .
docker run --rm -p 127.0.0.1:8080:8080 \
  -e CRM_ADMIN_TOKEN='replace-me' \
  -e CRM_INGEST_TOKEN='replace-me-too' \
  -v izakhono-crm-data:/data \
  izakhono/crm:0.1.0
```

Do not expose the administrative port directly to the public internet. Public access must pass through the approved IZAKHONO Access / FORTRESS / EDGE path with TLS and authentication.

## Status

This package is a portfolio CRM foundation, not a claim that every platform is already connected. A platform becomes CRM-connected only after its adapter is implemented and its intake / update flow passes an end-to-end test.

Infrastructure status follows the portfolio rule: owned-first, externally reversible. No public-live claim is made by this package alone.
