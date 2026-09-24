# Portfolio CRM Inheritance Standard

**Status:** Portfolio-wide implementation standard  
**Applies to:** every customer-facing IZAKHONO platform and every future product unless a signed exception supersedes it.

## Decision

All qualifying IZAKHONO platforms will use the shared **IZAKHONO CRM** relationship engine or a compatible adapter that preserves the same scope and audit rules.

The objective is not to make every business identical. Each platform keeps its own brand, product workflow, prices, legal entity, customer contract and protected product data. The CRM supplies the common commercial layer: prospect, contact, opportunity, activity, next action, pipeline and reporting.

## Mandatory capability set

A connected platform must provide:

1. lead / customer / partner intake into a scoped CRM contact;
2. a platform-specific opportunity pipeline;
3. visible stage, owner, source, value and next action;
4. mobile-friendly staff access;
5. activity history and follow-up dates;
6. dashboard totals for contacts, open opportunities, open value and won value;
7. safe export for authorised business continuity;
8. legal-entity and platform isolation;
9. an end-to-end test proving that a real platform event creates or updates the intended CRM record;
10. no silent change to the platform's payment, entitlement, regulated-data or fulfilment system.

## Shared commercial events

Preferred adapter events:

- `lead.created`
- `lead.qualified`
- `quote.requested`
- `enrolment.started`
- `checkout.started`
- `payment.confirmed`
- `entitlement.activated`
- `booking.confirmed`
- `proposal.sent`
- `agreement.signed`
- `renewal.due`
- `customer.won`
- `customer.lost`

The CRM does not independently declare a payment successful. Payment-confirmed events must come from the verified product payment / reconciliation path.

## Data boundary

Every CRM record carries both:

- `entity_id`
- `platform_id`

No portfolio-wide customer merge is permitted merely because the same person appears in two products. Cross-entity views require an explicit approved purpose, access rule and audit trail.

Protected product records remain in their product system. Examples:

- ECD360 child, classroom, payroll and learner-evidence records do not move into CRM.
- WorkNow jobseeker CV/profile records do not move into the B2B CRM by default.
- FORTRESS fraud signals, transaction payloads and security secrets do not move into CRM.
- Payment credentials and settlement secrets never belong in CRM.

## Platform-specific pipeline principle

The shared engine supports different stages per platform. Examples include:

- Clothing: enquiry → qualified → quote → PO/deposit → production → delivery.
- Edu-Build: enquiry → application → documents → fee/funding → enrolled → active learner.
- FAISReady: lead → offer → checkout → paid → entitled → active learner.
- KORA / Allegro: prospect → rights/commercial review → agreement → onboarding → active.
- WorkNow: employer prospect → demo → package → agreement → onboarding → hiring.
- FORTRESS: target account → discovery → technical validation → pilot → procurement/legal → production agreement.

The authoritative v1 registry is `products/izakhono-crm/portfolio-crm-registry.json`.

## AI and automation rule

V1 provides deterministic follow-up flags without requiring an external AI vendor.

The owner-controlled IZAKHONO AI Gateway may later add:

- call / meeting summaries;
- draft follow-up messages;
- next-step suggestions;
- pipeline summaries;
- account briefing;
- duplicate detection assistance.

AI output must remain advisory. It may not silently send communications, change a regulated decision, move money, confirm payment or overwrite protected customer data.

## Infrastructure

Owned target:

`NODE01 → IZAKHONO Core / PostgreSQL target → Access / FORTRESS → EDGE / TLS → authorised staff`

External infrastructure may be used reversibly when required under the portfolio infrastructure directive. A CRM package or adapter is not called live until the corresponding runtime and end-to-end platform intake have been verified.

## Rollout order

Wave 1:
- FAISReady
- Edu-Build Institute
- Izakhono Africa Clothing Manufacturing

Wave 2:
- KORA / KORA Cinema / Allegro-Vibez / Allegro Radio
- WorkNow
- AUTO AI / Learner Driver SA
- DOXA-SURE

Wave 3:
- Music School / Recording Studio / Memory Mania
- Business Websites / Supercool / ZEELY-style
- The Chancellor
- FORTRESS
- IZAKHONO Code / Work / Cloud / Send
- other current and future products

A later wave does not mean a platform is excluded from the shared standard; it only controls the adapter implementation sequence.
