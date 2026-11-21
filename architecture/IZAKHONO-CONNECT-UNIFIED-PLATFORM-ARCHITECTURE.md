# IZAKHONO CONNECT — Unified Platform Architecture

**Status:** Architecture proposal for controlled implementation  
**Working product name:** IZAKHONO CONNECT  
**Repository:** `izakhono-builder`  
**Decision:** Unify the existing connectivity/provisioning product and the new omnichannel engagement/automation product under one platform identity, while preserving distinct bounded contexts and data/security boundaries.

## 1. Product decision

IZAKHONO CONNECT is one modular business platform with two major product divisions:

1. **CONNECT INFRASTRUCTURE** — the existing I-CONNECT connectivity business capabilities: connectivity catalogue, provider registry, coverage checks, quotations, orders, provisioning workflows, customer handover and related operational control.
2. **CONNECT ENGAGEMENT** — the new ManyChat-class capabilities: omnichannel inbox, chatbot and visual automation, AI agents, CRM, campaigns, customer support, sales workflows and developer integrations.

These divisions share platform foundations and a coherent customer experience. They are not to be collapsed into one undifferentiated service or database domain.

## 2. Shared platform services

The following capabilities are shared, subject to verified contracts and security review:

- IZAKHONO ID integration for identity and authentication.
- Entity and tenant directory, with verified entity context.
- Role-based access and permission evaluation.
- Subscription, entitlement and billing integration.
- API gateway, versioning, webhook registration and rate limits.
- Audit and security event framework.
- Notifications and operational observability.
- Provider/connector registry and secrets references.
- Reporting foundations, with explicit domain-level data access.
- FORTRESS policy enforcement and outbound trust controls.

Shared infrastructure does not merge legal entities, customer records, payment ledgers, subscriptions or operational authority. Every record and request must preserve verified `entity_id` and tenant scope. Cross-division access must be explicit, authorised and audited.

## 3. Domain boundaries

### CONNECT INFRASTRUCTURE bounded context

Owns connectivity-specific concepts and state:

- connectivity products and service eligibility
- upstream connectivity providers and provider capability registry
- address/service coverage checks
- quotes and commercial product mappings
- service orders and upstream references
- provisioning state machine and exception handling
- activation evidence and customer handover

Existing provider adapter rules remain in force: manual is the safe default; an adapter is not active until credentials, commercial agreement, API contract and successful test transactions are verified. Never represent simulated coverage, ordering or activation as real.

### CONNECT ENGAGEMENT bounded context

Owns customer-engagement concepts and state:

- channel accounts and channel-specific permissions
- contacts and communication preferences
- conversations, inboxes, assignments and human handover
- workflow definitions, versions, executions and retries
- AI agents, knowledge sources, tools and evaluations
- CRM leads, opportunities, segments and customer journeys
- campaigns, delivery records, suppression lists and consent evidence
- engagement analytics and developer-facing integration configuration

Channel adapters must respect official platform permissions, consent, template requirements, service windows, opt-outs and applicable law. Do not promise identical capabilities across WhatsApp, Instagram, Facebook Messenger, TikTok, Telegram, email, SMS and web chat.

## 4. Integration between divisions

The divisions may collaborate through versioned internal APIs and domain events, not by directly mutating one another's tables.

Approved examples:

- A connectivity lead or order may trigger an engagement workflow.
- Provisioning status changes may produce customer-notification events.
- CONNECT ENGAGEMENT may create a support case associated with a connectivity service.
- CONNECT INFRASTRUCTURE may request an approved customer communication.
- Shared account and entitlement services may expose scoped product access.

Every cross-domain event must include a stable event ID, schema version, originating entity/tenant, correlation ID, timestamp and authorised subject/service identity. Consumers must be idempotent. Sensitive payloads should be minimised; use references and authorised retrieval where practical.

## 5. Reference architecture

```text
                    IZAKHONO CONNECT
                           |
             +-------------+-------------+
             |                           |
    CONNECT INFRASTRUCTURE       CONNECT ENGAGEMENT
    - catalogue/products         - omnichannel inbox
    - provider registry          - chatbots/workflows
    - coverage/quotes             - AI agents
    - orders/provisioning         - CRM/campaigns
    - activation/handover         - sales/support
             |                           |
             +-------------+-------------+
                           |
               SHARED PLATFORM SERVICES
        IZAKHONO ID / entity scope / RBAC / billing
        API gateway / event contracts / audit / usage
                           |
                 FORTRESS POLICY BOUNDARY
       default-deny outbound / secrets / audit / controls
                           |
             HOST and approved software runtime
          NODE01 remains a logical software identity
```

The diagram describes logical boundaries, not a claim that all services are implemented or deployed.

## 6. Data and security rules

1. Preserve the existing I-CONNECT connectivity schema and production data. No destructive consolidation or table renaming as part of the architecture merge.
2. Establish separate schemas or clearly bounded data ownership for infrastructure and engagement domains, based on a reviewed migration plan.
3. Tenant/entity identity must be derived from trusted authentication/service context, never trusted from arbitrary client-supplied values.
4. Enforce row-level and service-level access controls; test cross-tenant and cross-entity denial.
5. Keep provider credentials, channel tokens, AI keys and service-role secrets server-side in approved secret storage.
6. Record administrative, financial, provisioning, consent and security-sensitive state changes in audit trails.
7. Apply data minimisation, retention, export and deletion controls, and POPIA-aligned processing.
8. External model, messaging, analytics and cloud providers are replaceable adapters, not authorities for IZAKHONO identity, tenancy, billing or source-of-truth state.
9. Follow the existing FORTRESS sovereign boundary: default deny outbound, explicit entity scope, sanitise before external use, and prevent external single points of failure.
10. Follow `AGENTS.md` and the canonical NODE01 Identity Standard. NODE01 is software, not a physical or virtual machine.

## 7. Product navigation

Proposed top-level CONNECT workspace:

- Overview
- Customers
- Conversations
- Automation
- AI Agents
- CRM & Sales
- Campaigns
- Connectivity
- Orders & Provisioning
- Providers & Integrations
- Analytics
- Team & Access
- Billing & Plans
- Developer API
- Security & Audit
- Platform Administration

Navigation and data visibility must be permission- and entitlement-aware. A user should only see modules authorised for their entity, role and subscription.

## 8. Repository and implementation strategy

Keep the current repository as the source location for the architecture proposal and shared platform integration work. Do not create a second competing CONNECT control plane.

Recommended logical layout (adapt to the actual repository conventions after discovery):

- `products/connect/engagement/` — engagement domain application/services
- `products/connect/infrastructure/` — connectivity domain references/integration boundaries; preserve existing implementation until a safe migration is approved
- `packages/connect-contracts/` — versioned API and event schemas
- `packages/connect-ui/` — shared design components only where appropriate
- `docs/connect/` — product, architecture, operations and compliance documentation

This is a target layout, not a statement that these paths or modules already exist. Before creating or moving code, inventory existing paths, dependencies, migrations, tests and deployments. Avoid duplicate services and avoid moving stable I-CONNECT functionality merely for cosmetic consistency.

## 9. Phased implementation

### Gate 0 — Discovery and preservation
- Inventory current I-CONNECT frontend, backend, database schema, migrations, APIs, provider adapters, jobs and deployment configuration.
- Identify reusable IZAKHONO ID, FORTRESS, billing, audit and tenant services.
- Map existing data ownership and dependencies.
- Record baseline tests and current operational status.
- No destructive changes.

### Gate 1 — Unified contracts and control plane
- Approve domain boundaries and service contracts.
- Define entity/tenant context propagation.
- Define shared navigation and module entitlement model.
- Define versioned domain events and idempotency requirements.
- Add architecture decision records and threat model.

### Gate 2 — Engagement foundation
- Add engagement domain schema and access policies.
- Implement contacts, channel-account registry and conversation primitives.
- Build authenticated inbox shell.
- Add web chat first, then provider-approved messaging adapters.

### Gate 3 — Automation and AI
- Implement versioned workflow definitions and execution engine.
- Add trigger/action registry, retries and dead-letter/exception handling.
- Add AI agent orchestration, knowledge sources, evaluation and human handover.
- Meter usage and enforce per-tenant limits.

### Gate 4 — Shared customer journeys
- Integrate connectivity order/provisioning events with engagement notifications.
- Add support cases linked by authorised references.
- Validate consent, delivery status, audit and cross-domain isolation.

### Gate 5 — Commercial readiness
- Integrate approved plans, entitlements and billing.
- Add agency, enterprise and white-label administration.
- Complete operational, security, privacy, resilience and customer acceptance testing.

## 10. Non-negotiable acceptance criteria

- Existing connectivity journeys continue to work; regression tests pass.
- No existing customer, order, provider or provisioning records are lost or silently reclassified.
- Cross-tenant and cross-entity access tests deny unauthorised access.
- Engagement and infrastructure domains cannot write directly to each other's persistence.
- Cross-domain events are versioned, authenticated, auditable and idempotent.
- Provider/channel integrations report verified readiness accurately; no simulated success.
- Credentials remain server-side and are never exposed in browser bundles or logs.
- Consent, opt-out, retention and deletion requirements are testable.
- AI actions with financial, provisioning, identity or other material effects require explicit policy controls and, where appropriate, human approval.
- Backup/restore, monitoring, incident response and rollback are documented and tested.
- Production release is evidence-gated and explicitly authorised.

## 11. Current status and immediate next action

This document records the unified architecture decision. It does not claim that the divisions have already been merged in code, database or production.

The next engineering action is **Gate 0 discovery and preservation**: inventory the existing I-CONNECT implementation and shared IZAKHONO services, then produce a verified component map and migration plan. Only after review should implementation changes begin.

Deployment must continue to respect the approved HOST/NODE01 access and execution gates. Do not run activation scripts prematurely.
