# IZAKHONO Infrastructure — I-CONNECT Commercial Go-to-Market & Operating Plan

**Status:** Commercial design baseline; pre-contract and pre-production where stated  
**Accountable practice:** IZAKHONO Infrastructure, coordinated with Security & Connectivity and Data & Digital Products  
**Customer brand:** IZAKHONO GLOBAL  
**Operating platform:** I-CONNECT Corporate Command  
**Market:** South Africa first; Africa-ready architecture

## 1. Executive decision

Build the connectivity-enabled business-services offer on IZAKHONO's existing infrastructure and product architecture. Do not create a parallel hosting platform, duplicate customer identity, or introduce another externally dependent control plane.

IZAKHONO Infrastructure supplies owned-first hosting, runtime, data, DNS, edge, backup and operational foundations. I-CONNECT supplies connectivity product orchestration, customer/service operations, partner adapters and service lifecycle. FORTRESS supplies security and governance. PROVISIONER supplies controlled typed jobs. I-PAY supplies payment capabilities subject to its own production release gate. IZAKHONO HOST remains the hosting/runtime system of record.

The business earns revenue from software, managed services, implementation, support and approved connectivity resale. It does not rely on an unapproved carrier relationship or claim that software creates radio coverage.

## 2. Canonical brand and product boundaries

- **IZAKHONO Infrastructure:** corporate practice responsible for owned hosting, runtime architecture, cloud/hybrid infrastructure, network foundations, resilience, backup/recovery and managed infrastructure.
- **IZAKHONO GLOBAL:** customer-facing brand for integrated connectivity and communications services.
- **I-CONNECT:** operating platform/control centre for customers, organisations, catalogues, providers, orders, provisioning, billing, communications and service intelligence.
- **FORTRESS:** identity, access, device trust, audit, security policy and evidence.
- **PROVISIONER:** idempotent typed provisioning orchestration and exception management.
- **I-PAY:** payment integration and merchant services, subject to its independent release gate.
- **IZAKHONO HOST:** owned-first hosting/runtime control plane.
- **IZAKHONO ONE and other business products:** complementary applications; not duplicate connectivity control planes.

Do not introduce competing product names or duplicate existing IZAKHONO products.

## 3. Target customers and problems

### Micro and small businesses
Fragmented connectivity, unreliable support, disconnected customer records, weak backup practices and unclear IT costs. Offer a managed digital foundation, business workspace, secure hosting, support and optional connectivity sourced through approved providers.

### Growing SMEs and multi-branch businesses
Multiple suppliers, inconsistent branch connectivity, weak visibility, manual onboarding and poor incident handling. Offer central service operations, multi-site inventory, connectivity coordination, business software, backup, monitoring and consolidated reporting.

### Enterprise and public institutions
Supplier fragmentation, complex integrations, security and audit requirements, resilience gaps, legacy systems and procurement constraints. Offer discovery and architecture, integration, managed infrastructure, service orchestration and contracted delivery with explicit SLAs and responsibilities.

### Channel and reseller partners
Difficult provisioning, unclear commissions and weak escalation. Offer controlled reseller workflows, quote/order tracking, service status, partner-specific pricebooks and auditable commissions after agreement.

## 4. Initial commercial offers

Launch with services deliverable without waiting for a mobile operator deal.

1. **Infrastructure & Resilience Assessment:** fixed-scope review of hosting, deployment, backup, recovery, network dependencies, security boundaries and cost. Deliver findings, risk register and prioritised remediation plan.
2. **Managed Digital Foundation:** domain/site/email coordination, secure business workspace, backups and support, only where the specific HOST service has passed operational acceptance.
3. **Connectivity Management:** supplier-neutral discovery, quotation, order tracking and fault coordination. Fulfilment only through a contracted and approved provider.
4. **Multi-site Business Connectivity:** branch inventory, provider comparison, failover design, monitoring and support. Actual failover requires tested customer/provider equipment and service.
5. **Enterprise Integration & Operations:** API integration, customer/service inventory, ticketing, provisioning workflows, audit and reporting.
6. **I-CONNECT Platform Licence:** subscription for customer/reseller/enterprise control-plane functions as each capability is released and supportable.

## 5. Revenue streams

- Fixed-fee assessment and architecture engagements.
- Milestone-based implementation and integration projects.
- Monthly software subscriptions for released I-CONNECT capabilities.
- Managed infrastructure and support retainers with defined scope and service hours.
- Hosting, storage and backup subscriptions only after HOST production acceptance and capacity/cost validation.
- Connectivity resale margin or referral commission only under executed provider agreements and transparent customer terms.
- Enterprise service-management and integration contracts.
- Training and onboarding fees where separately scoped.

No artificial AI-credit wallet, per-prompt charge or per-build charge. Forecast revenue is not booked revenue until supported by a signed contract and recognised billing event.

## 6. Sales-to-delivery process

Discover → qualify → assess → design → quote → contract → onboard → provision → accept → operate → review → renew/expand.

Every opportunity records:
- legal customer name and authorised contacts;
- business problem and measurable desired outcome;
- locations/sites and service requirements;
- selected engagement model and product entitlements;
- provider dependency and readiness status;
- scope, assumptions, exclusions and customer responsibilities;
- pricebook version, taxes, pass-through charges and payment terms;
- delivery owner, target dates, risks and acceptance criteria;
- support boundary, service hours and escalation route;
- signed order/contract and audit trail.

Do not accept an order for a service that is not orderable, compliant, costed and deliverable.

## 7. Provider strategy

Maintain a provider-neutral registry. Evaluate mobile network operators, fibre wholesalers, ISPs, MVNEs, SIP/voice providers and satellite providers separately. A provider becomes production-eligible only after all evidence gates in the mobile-operator architecture are met.

Score providers on wholesale pricing, price stability, verified coverage, fulfilment reliability, API completeness, SLA and escalation, customer ownership, branding/data terms, regulatory allocation, settlement/reconciliation and exit/portability terms.

Never make the commercial plan exclusive to MTN or Telkom. Pursue multiple providers and preserve migration options.

## 8. Operating responsibilities

- **Infrastructure:** HOST capacity, runtime, DNS/edge, data services, backups, restore tests, observability and environment readiness.
- **Engineering:** I-CONNECT application, API contracts, adapters, tests and release management.
- **Security:** FORTRESS policy, threat modelling, access reviews, secrets, audit, privacy and incident controls.
- **Operations:** service desk, customer onboarding, order exceptions, supplier escalation and service reviews.
- **Commercial:** pricebooks, contracts, partner negotiations, sales pipeline and customer success.
- **Finance:** invoices, payment reconciliation, refunds, wholesale cost, taxes, settlement and revenue recognition.

No role may bypass its approval or audit boundary.

## 9. Launch sequence

### Wave 0 — readiness and design
Inventory existing HOST, I-CONNECT, FORTRESS, PROVISIONER and I-PAY capabilities. Map each as implemented, partial, specified, deployed, verified or blocked. Establish catalogue, pricebook, legal review, cost model and operational ownership.

### Wave 1 — software-first pilot
Pilot customer account, service catalogue, quotes, service tickets, status visibility and support workflows using synthetic data or real non-carrier services already authorised. No live SIM/eSIM, PSTN, SMS, carrier purchase or real connectivity activation without provider approval.

### Wave 2 — HOST-backed managed services
Offer only hosting, website, backup, DNS and infrastructure services for which physical runtime, public reachability, security, capacity, backup/restore and customer acceptance are evidenced. A code merge or CI pass alone is not production evidence.

### Wave 3 — approved connectivity partner
Execute provider agreement, pricebook, technical certification, compliance allocation and end-to-end test. Start with a limited cohort and daily reconciliation.

### Wave 4 — scale
Add resellers, enterprise customers, providers and African markets only after local legal, regulatory, tax, data and operational review.

## 10. KPI framework

Track weekly: qualified pipeline and conversion; signed recurring contract value and collected revenue separately; software gross margin and connectivity contribution margin separately; active paying customers and net revenue retention; provisioning success and time to verified activation; unresolved exceptions; response/resolution times against contracted support hours; measured service availability; provider concentration; churn, refunds, disputes and bad debt; backup/restore success; security incidents and overdue remediation.

Set numerical targets only after baseline measurement and capacity review.

## 11. Public-claims policy

Never claim:
- IZAKHONO is a mobile network operator unless legal and operational status supports it;
- MTN, Telkom, Openserve, BCX or another provider is a partner without an executed agreement;
- SIM, eSIM, fibre, voice, SMS, satellite or emergency service is live without verified upstream evidence;
- HOST is production-live without current DNS, HTTPS, intended-content, security and recovery acceptance;
- an SLA, coverage, speed, uptime or price is guaranteed unless contractually supported;
- a security certification or regulatory approval exists without current documentary evidence.

Use explicit status labels: planned, sandbox, pilot, contracted, production-verified, paused or retired.

## 12. Immediate management decisions

1. Confirm IZAKHONO Infrastructure as accountable practice for HOST-backed service delivery.
2. Approve I-CONNECT as operating platform and IZAKHONO GLOBAL as customer-facing brand.
3. Approve a non-exclusive provider discovery programme, not an assumed carrier partnership.
4. Approve software-first pilot scope and prohibit carrier fulfilment until evidence gates pass.
5. Require per-service cost and gross-margin model before publishing tariffs.
6. Keep physical production activation behind the authorised HOST/NODE execution gate.
