# IZAKHONO GLOBAL / I-CONNECT — Control Centre & Mobile App Build Specification

**Status:** Approved engineering direction / implementation specification  
**Market entry:** South Africa first; architecture global-ready  
**Delivery principle:** Software-owned, provider-neutral, security-first, partner-powered connectivity  
**Commercial principle:** Predictable flat-rate software subscriptions; pass-through connectivity priced against verified wholesale costs.

## 1. Product decision

IZAKHONO GLOBAL is the customer-facing connectivity and communications business. I-CONNECT is its operating system: the software control plane for customers, organisations, services, provider integrations, provisioning, billing, support and network intelligence.

The first commercial release is not a mobile network. It is a working software product that can serve business customers over existing internet and communications providers. Carrier connectivity ordering, SIM/eSIM activation, PSTN calling, SMS delivery and satellite services remain disabled until the relevant provider agreement, regulatory review, credentials, certification and end-to-end acceptance tests are complete.

## 2. Product surfaces

### 2.1 I-CONNECT Control Centre (web)

A responsive, multi-tenant operations console with role-based views:

- **Executive overview:** verified active customers, recurring software revenue, service subscriptions, incidents, unresolved orders, gross margin and provider dependency.
- **Customer management:** organisations, branches, contacts, users, permissions, service entitlements and account status.
- **Service catalogue:** software products, connectivity products, plan versions, eligibility, price books, tax treatment and availability disclosures.
- **Orders & provisioning:** quotes, checkout, verified payment events, idempotent jobs, step history, retries, manual review and customer handover.
- **Connectivity operations:** provider registry, adapter status, service inventory, SIM/eSIM references, network events and reconciliation. Unconfigured/sandbox providers must be visibly marked.
- **Communications:** voice/PBX provider status, numbers, queues, call records and messaging status only where the connected service actually supports them.
- **Fleet & emergency:** vehicle/driver links, incidents, alert delivery states and human acknowledgement; integrate with NAV without claiming GPS or emergency routing where no source exists.
- **Billing & finance:** subscriptions, invoices, payments, refunds, usage records, wholesale cost, revenue allocation and margin.
- **FORTRESS:** devices, sessions, access policies, audit events, security alerts and revocation workflows.
- **Analytics:** customer retention, ARPA, recurring revenue, cost-to-serve, provider concentration, successful provisioning and service reliability.
- **Platform administration:** feature flags, environment, audit, configuration and release status.

### 2.2 IZAKHONO GLOBAL mobile app

Build smartphone-first for Android and iOS. Begin with a shared cross-platform client where practical, with native modules for secure key storage, notifications, audio, permissions and device-specific connectivity capabilities.

Primary navigation:
1. Home
2. Communicate
3. Services
4. Safety
5. Account

Initial customer features:
- Secure sign-in, MFA and device enrolment with FORTRESS.
- Personal and business profiles, organisation switching and role-aware access.
- One-to-one and group text over internet.
- Voice notes and internet voice/PTT only after the media/signalling service is implemented and tested.
- Contact directory, presence with explicit privacy controls, block/report and group membership.
- Customer service catalogue, order status, subscription and invoices.
- Trusted contacts, SOS workflow, timestamped location sharing and transparent delivery status.
- Notifications for account, service, payment and security events.
- Support requests and incident timeline.

Not in the first release unless separately integrated and certified:
- Native cellular number replacement.
- Automatic carrier handover.
- Guaranteed offline messaging or mesh networking.
- Universal satellite messaging.
- Public emergency-service dispatch.
- Always-on microphone/location tracking.
- Carrier SIM/eSIM activation.

## 3. Role model and tenant boundaries

Roles:
- platform_owner: tightly restricted IZAKHONO platform administration.
- platform_operator: operations access with explicit permission scopes.
- organisation_owner: controls one customer organisation.
- organisation_admin: manages permitted users, branches and services.
- billing_admin: billing and payment visibility, no security administration.
- dispatcher: fleet/incident operations for assigned organisation.
- agent: assigned communications/customer-support workflows.
- member: own account and entitled services.
- auditor: read-only, time-bounded access.

Every tenant-owned record must carry organisation_id and be checked server-side. Do not rely on hidden UI controls for authorisation. Cross-tenant access tests are mandatory. Platform-wide roles must not be granted through user-editable metadata.

## 4. Control Centre information architecture

### Executive dashboard
- Customers: verified count from database.
- Software MRR: active, non-cancelled subscriptions only; exclude one-off connectivity usage.
- Orders: grouped by lifecycle state.
- Provisioning: queued, processing, completed, failed, manual-review.
- Provider readiness: contract, credentials, sandbox, certification, production approval.
- Incidents: open severity, age, owner and next action.
- Financial health: collected revenue, outstanding invoices, refunds, provider cost and gross margin.

Every metric must show source, reporting window and last-updated time. If a source is unavailable, display Unavailable or Not connected, never invented sample values. Demo data must carry a persistent DEMO / SIMULATED label and be excluded from commercial reporting.

### Provider readiness model
Use explicit states:
DISCOVERY -> COMMERCIAL_REVIEW -> CONTRACTED -> CREDENTIALS_CONFIGURED -> SANDBOX_TESTING -> CERTIFIED -> PRODUCTION_APPROVED -> SUSPENDED.

No transition to PRODUCTION_APPROVED without evidence references for agreement, pricebook, API certification, security review, regulatory review and named internal approver. Credentials alone never establish readiness.

### Service lifecycle
DRAFT -> QUOTED -> PAYMENT_PENDING -> PAYMENT_VERIFIED -> PROVISIONING_QUEUED -> PROVISIONING -> ACTIVE.

Exception paths:
PAYMENT_FAILED, PROVISIONING_FAILED, MANUAL_REVIEW, SUSPENDED, CANCELLED, TERMINATED.

Only an authoritative provider/owned-system confirmation may transition a connectivity service to ACTIVE. A successful internal job is not proof of carrier activation.

## 5. Core system architecture

Web/mobile clients
-> API gateway / application server
-> Supabase Auth + FORTRESS device/session verification
-> tenant and policy authorisation
-> domain services:
   - identity and organisation
   - catalogue and pricing
   - orders and payment ledger
   - provisioning orchestrator
   - provider adapter gateway
   - communications
   - incident and notification
   - billing and usage
   - analytics and audit
-> provider systems / owned services.

Supabase remains the current application data/auth foundation. Keep provider secrets server-side. Use Edge Functions or server services for privileged actions; do not expose service-role credentials to browsers or mobile clients.

## 6. Required service boundaries

- identity: account, organisation, membership, roles, MFA and device state.
- catalogue: products, plan versions, eligibility and price books.
- orders: quotes, order, idempotency and lifecycle.
- payments: payment intent, verified webhook, ledger, refund and reconciliation.
- provisioning: durable jobs, step attempts, retries, compensation and exception queue.
- providers: provider registry, capability manifest, credentials reference, health and adapter calls.
- connectivity: service inventory, SIM/eSIM references, usage and provider status.
- messaging: conversations, membership, message envelopes, delivery receipts and abuse controls.
- voice: session signalling, provider integration and call state; do not store raw media unless required and approved.
- incidents: SOS, contact notification, location snapshot, delivery attempts and human acknowledgement.
- security: FORTRESS checks, device registry, session mapping and audit.
- billing: subscription ledger, invoices, payment reconciliation, wholesale costs and margin.

## 7. Data and security rules

- Tenant-owned tables include organisation_id, created/updated timestamps and actor/audit context.
- Money is integer minor units (ZAR cents) plus ISO currency; never floating point.
- All order/payment/provisioning writes are idempotent.
- Payment confirmation comes only from a verified provider webhook or trusted server-side verification, never a client redirect.
- Webhooks require signature validation, replay protection, event deduplication and reconciliation.
- Provider secrets are stored in a secrets manager, never in client bundles, logs or repository.
- RLS enabled for exposed tables; tenant ownership checks in policies and server services.
- Sensitive actions require recent authentication/MFA and FORTRESS session verification.
- Use short-lived access, session revocation checks and audit logs for privileged actions.
- Encrypt transport; use reviewed protocols for end-to-end encrypted messaging. Do not invent cryptography.
- Location is opt-in, purpose-limited, timestamped and retained only as disclosed and lawful.
- No hidden microphone, camera or location collection.
- Apply POPIA, RICA and sector-specific review to the exact service before launch.

## 8. Integration sequence

1. Supabase Auth + FORTRESS client enrolment and protected API middleware.
2. Organisation/tenant and role model.
3. Catalogue, subscription, order and billing ledger.
4. Payment gateway server-side verification and reconciliation.
5. Provisioning job engine with a simulator isolated from production.
6. Internet messaging and notification service.
7. Voice/PTT media/signalling provider integration.
8. Carrier/MVNE adapter after contract and sandbox certification.
9. SMS, PSTN, eSIM and satellite adapters only after individual approval.
10. NAV fleet/incident integration.

## 9. First release acceptance gates

### Control Centre
- No hard-coded commercial metrics or fictitious live customer records.
- All dashboard metrics trace to queries and show freshness.
- Tenant isolation tests pass for every tenant-owned endpoint and table.
- Role permissions are enforced server-side.
- Order/payment/provisioning history is auditable and idempotent.
- Provider status accurately distinguishes unconfigured, sandbox and production.
- Failed and uncertain payment states never trigger duplicate charges.
- Mobile and desktop layouts pass accessibility and responsive checks.

### Mobile app
- Android and iOS login, MFA and FORTRESS device enrolment verified on real devices.
- Device revocation blocks protected APIs, not just hides UI.
- Messages show queued/sent/delivered/acknowledged as separate evidence-backed states.
- Push notifications do not disclose sensitive message content by default.
- SOS requires deliberate user action and displays exactly which contacts/routes were actually reached.
- Permission denial, weak signal, app backgrounding, battery saver and device restart tested.
- No public emergency-service test calls without prior coordination.

### Release governance
No production launch until automated tests, security review, privacy/regulatory review, operational runbooks, backups/restore test, monitoring and incident response are complete. A deployment is not a launch; a green health endpoint is not proof of provider service.

## 10. Delivery backlog

### Sprint 0 — truth and foundations
- Remove or permanently label static demo metrics and fictitious customer/agent/fleet data.
- Replace optimistic health flags with dependency-specific checks and explicit readiness states.
- Confirm existing schema, RLS, APIs and current application entry points.
- Establish development/staging/production separation and feature flags.

### Sprint 1 — tenant and identity
- Organisation, membership and role model.
- FORTRESS client enrolment and protected server middleware.
- Cross-tenant and revoked-device tests.

### Sprint 2 — commercial core
- Product catalogue and versioned price books.
- Customer subscription, quote, order and invoice.
- Verified payment webhook, immutable ledger and reconciliation.

### Sprint 3 — provisioning
- Durable jobs, idempotency, bounded retries, provider adapter contract and exception queue.
- Simulator clearly separated from production.
- Evidence-backed service activation.

### Sprint 4 — communications MVP
- Conversation, group membership, internet text, notification and delivery receipts.
- Abuse controls, block/report and privacy settings.
- Voice/PTT architecture and selected provider decision.

### Sprint 5 — safety and mobile pilot
- Android/iOS app shell, FORTRESS secure storage, contacts, SOS and timestamped location.
- Real-device test matrix and pilot with invited users.

### Sprint 6 — commercial pilot
- First business customers, support operations, service-level reporting and unit economics.
- Carrier/MVNE integration only when approval gates are satisfied.

## 11. Operating KPIs

- Paying organisations and active seats.
- Software MRR, churn, ARPA and gross margin.
- Payment success and refund rate.
- Order-to-activation time.
- Provisioning success / manual-review rate.
- Provider API availability and concentration.
- Message delivery and acknowledgement rates.
- Voice setup success and call quality (when implemented).
- SOS contact delivery and acknowledgement latency.
- Security incidents, revoked-session enforcement and audit completeness.

## 12. Definition of done

A feature is done only when the implementation exists, automated tests pass, relevant integration tests pass, real-device tests pass where applicable, security/privacy gates are documented, monitoring exists and the production status is verified. Documentation, mockups and configured credentials alone do not constitute a working service.
