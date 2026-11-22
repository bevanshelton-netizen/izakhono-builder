# IZAKHONO Open Economy — End-to-End Execution Playbook

**Programme owner:** IZAKHONO Africa (Pty) Ltd  
**Commercial platform:** I-CONNECT  
**Customer proposition:** IZAKHONO GLOBAL  
**Market sequence:** South Africa first; other African markets only after local review  
**Status:** Controlled execution baseline; not a claim of production readiness, partner appointment or regulatory approval  
**Related tracker:** GitHub Issue #741

## 1. Outcome and definition of complete

Build a commercially operable, secure and evidence-led digital infrastructure offer that helps businesses discover, buy, manage and receive approved business technology services through one accountable IZAKHONO experience.

The programme is complete only when all applicable conditions below are evidenced:

1. **Product truth:** every catalogue item has an owner, version, customer journey, implementation status, dependencies, exclusions and service-specific release state.
2. **Commercial truth:** every saleable item has an approved cost model, pricebook version, tax treatment, contract terms, support scope and contribution-margin approval.
3. **Partner truth:** every provider-dependent item has a verified provider, named commercial and technical owners, executed agreement, serviceability evidence, approved wholesale pricebook, responsibility allocation and tested fulfilment path.
4. **Technical truth:** each enabled workflow passes automated and operational acceptance for authentication, tenant isolation, authorization, persistence, idempotency, audit, observability, recovery and failure handling.
5. **Regulatory and privacy truth:** the activity perimeter, licence/authorisation dependencies, customer disclosures, data roles, lawful processing, retention, complaints and incident obligations have been reviewed and accepted by qualified advisers and accountable owners.
6. **Operational truth:** customer onboarding, service desk, incident response, supplier escalation, billing, reconciliation, cancellation and service exit have named owners and rehearsed procedures.
7. **Production truth:** any production service has an authorized HOST execution path, registered runtime, independently verified HTTPS/health/content evidence, backup/restore proof, security acceptance and customer sign-off.
8. **Measurement truth:** actual customer outcomes, collected revenue, cost-to-serve, gross/contribution margin, service quality and unresolved risks are reported separately from forecasts and pipeline.

A merged pull request, successful CI run, sent proposal, sandbox response or verbal discussion does not independently satisfy these conditions.

## 2. Product and system boundaries

| Layer | Accountable responsibility | Must not become |
|---|---|---|
| IZAKHONO Africa | Corporate ownership, IP, governance, commercial accountability | A claim of regulated permissions not held |
| IZAKHONO GLOBAL | Customer-facing business-services proposition | A claim to be an MNO or carrier |
| I-CONNECT | Customer, organisation, catalogue, quote, order, service inventory, partner orchestration and support workflows | A second HOST, identity, ledger or payment system |
| IZAKHONO HOST / Runtime Fabric | Approved hosting, runtime, deployment and infrastructure system of record | A software-only NODE01 identity presented as a physical machine |
| FORTRESS | Identity/security policy, access decisions, audit and evidence | An unreviewed substitute for legal or operational controls |
| PROVISIONER | Typed, bounded, idempotent provisioning jobs and exception handling | Arbitrary execution or unapproved provider activation |
| I-PAY | Payment and merchant workflows under its own release and provider approvals | Custody, acquiring or settlement without required authorisation |
| External providers | Regulated/network/wholesale service delivery within executed scope | Ownership of IZAKHONO IP or customer relationship by default |

Reuse existing systems of record. Before adding a field, table, queue, identity store or adapter, document the authoritative owner and migration/compatibility impact.

## 3. First commercial wedge

Start with offers that can be delivered without an unapproved carrier agreement:

- Infrastructure and resilience assessment with a fixed deliverable.
- Architecture, integration and business-process implementation services.
- I-CONNECT software workflows that have passed their own release gates.
- Managed digital services only where the exact HOST-backed service has passed physical production, security, capacity and recovery acceptance.
- Connectivity discovery, comparison, quotation and order tracking as a managed coordination service; actual fulfilment only through an approved provider.

Do not sell live SIM/eSIM activation, airtime/data, carrier voice, SMS, satellite, public numbering, emergency calling, automatic network failover or any other provider-dependent service until its specific partner, legal, technical and operational gates are green.

## 4. Customer journey and order lifecycle

The canonical journey is:

**Discover → qualify → assess → design → quote → contract → onboard → order → provision → verify → accept → support → review → renew / cancel.**

Each opportunity and order must carry:
- immutable customer and tenant identity;
- authorised contact and consent/provenance;
- catalogue SKU and version;
- service location and serviceability result where relevant;
- quote ID, pricebook version, taxes, pass-through costs and expiry;
- contract/order references and customer acceptance;
- provider and provider-service references where applicable;
- current lifecycle state, state-change actor, timestamp and evidence;
- support owner, severity, next action and escalation;
- cancellation, refund, dispute and exit status where applicable.

Recommended order state machine:

`DRAFT → QUOTED → ACCEPTED → VALIDATING → READY_TO_PROVISION → PROVISIONING → AWAITING_PROVIDER → VERIFYING → ACTIVE`

Controlled terminal or exception states:

`REJECTED, CANCELLED, FAILED, SUSPENDED, DISCONNECTED, MANUAL_REVIEW`

Rules:
- Only an authoritative, authenticated source may confirm an external service activation.
- A UI action, queued job, synthetic provider, callback without verification or successful HTTP request cannot mark a service ACTIVE.
- Retries must use scoped idempotency keys bound to tenant, environment, operation and immutable request intent.
- State transition, audit event and outbox/inbox record must commit atomically within the authoritative persistence boundary.
- Invalid or contradictory provider evidence moves to MANUAL_REVIEW; it must not be silently repaired into success.
- Every transition records actor/service identity, reason, timestamp, correlation ID and evidence reference.

## 5. Technical completion requirements

### Identity and isolation
- Enforce tenant, application and environment boundaries server-side on every read and write.
- Do not trust tenant IDs, roles, provider IDs or environment values supplied only by a browser.
- Use least privilege, MFA for privileged roles, short-lived credentials and documented service identities.
- Test cross-tenant, cross-application and cross-environment denial paths.

### Persistence and consistency
- Identify the authoritative database for each aggregate.
- Use migrations only against the owning database and prove compatibility with existing data.
- Commit deployment/order state, audit and outbox evidence atomically where they form one business transaction.
- Define retention, deletion, backup, restore and replay procedures.
- Test concurrent duplicate requests, replay, timeout-after-commit, process restart and partial failure.

### Provider adapters
- Keep a provider-neutral canonical contract and isolate each supplier's API in a versioned adapter.
- Validate signatures, timestamps, event IDs, replay windows, schema and provider account identity.
- Persist raw evidence securely with redaction and retention controls; store parsed normalized state separately.
- Support polling/reconciliation where webhooks are delayed, duplicated or unavailable.
- Implement timeout, retry with bounded backoff, circuit-breaker, dead-letter and operator recovery paths.
- Never expose provider credentials to browser code or logs.

### Operations
- Correlation IDs across customer, order, provider, payment, provisioning and support records.
- Metrics for order age, activation evidence, retry rate, exception backlog, reconciliation drift and tenant-isolation failures.
- Runbooks for provider outage, duplicate event, missing settlement, failed fulfilment, data incident and restore.
- Alert routing and escalation ownership must be tested, not merely documented.

## 6. Commercial unit economics and price approval

No internal hypothesis becomes a public tariff until a signed-off pricebook version exists.

For each SKU calculate:

`Net revenue = customer charge excluding applicable taxes and pass-through amounts`

`Direct cost = provider wholesale + hosting/compute/storage/bandwidth + payment fees + delivery labour + support allocation + fraud/loss allowance`

`Contribution = net revenue - direct cost`

`Contribution margin % = contribution / net revenue × 100`

Record one-off and recurring economics separately. Include:
- provider setup, minimum commitment, usage bands and price-change rights;
- payment/acquiring fees, settlement timing, refunds and chargebacks;
- hosting capacity, redundancy, bandwidth, backup and restore costs;
- onboarding, implementation, support hours and escalation costs;
- taxes, invoicing, bad debt and FX exposure where applicable;
- customer acquisition cost and expected payback, explicitly labelled as forecast until observed.

Approval chain: product owner validates scope → operations validates cost-to-serve → finance validates tax and margin → legal validates terms/disclosures → accountable executive approves pricebook version. Any material provider cost change triggers revalidation.

## 7. Partner qualification and contracting

No single operator is the programme's critical dependency. Maintain a non-exclusive provider pipeline across mobile, fibre, ISP, MVNE/MVNO enablement, voice and other relevant infrastructure categories.

Before a provider becomes production-eligible, obtain and verify:
- legal entity, authority of signatory and service scope;
- named commercial sponsor, technical owner and escalation contact;
- serviceability/coverage evidence for the target cohort and locations;
- wholesale pricebook, minimums, taxes, billing unit, price-change and dispute terms;
- API specifications, sandbox, credentials process, event signatures and support SLA;
- data-sharing roles, security controls, retention and incident notification;
- customer ownership, branding, marketing permissions and portability/exit rights;
- regulatory allocation and any required licence/approval evidence;
- executed contract, order form and pilot acceptance plan.

Default commercial posture is non-exclusive. IZAKHONO retains its IP, software, platform architecture, customer experience and customer relationship unless a specifically negotiated contract states otherwise and receives approval. Do not disclose FORTRESS source code, detection logic, private architecture or credentials during introductory discussions.

## 8. Pilot operating model

### Cohort
Target 20–50 South African businesses only after support capacity, customer consent and offer economics are confirmed. This is a planning range, not a commitment or guaranteed cohort size.

### Pilot scope
Start with software-first workflows: onboarding, organisation/user administration, catalogue, assessment, quote, order tracking, service tickets, status/evidence display and customer feedback. Use synthetic provider data only when clearly labelled and technically unable to produce production ACTIVE states.

Add a real provider-dependent service only after its individual legal, partner, technical, commercial and operational gates are accepted.

### Acceptance measures
Establish baseline before setting numeric targets. Report:
- qualified leads, conversion and onboarding completion;
- time from accepted quote to verified delivery;
- active paying customers separately from trials and prospects;
- invoiced, collected and reconciled revenue separately;
- per-SKU contribution and cost-to-serve;
- support tickets per customer and response/resolution against the agreed support scope;
- provider fulfilment success based on authoritative evidence;
- refunds, disputes, cancellations and churn;
- security/privacy incidents and overdue remediation;
- restore-test outcome and service availability evidence.

### Stop conditions
Pause the affected SKU or workflow if customer billing is inaccurate, fulfilment cannot be verified, provider serviceability is uncertain, tenant isolation fails, payment/settlement cannot reconcile, security/privacy/legal concerns arise, or the service cannot meet its published terms.

## 9. Programme governance

| Role | Decision/accountability |
|---|---|
| Executive sponsor | Strategy, capital allocation, material risk acceptance and final go/no-go |
| Programme lead | Integrated plan, dependencies, decisions, weekly evidence and escalation |
| Product owner | SKU boundaries, customer journeys, roadmap and acceptance |
| Engineering lead | Architecture, implementation, tests, releases and technical evidence |
| Infrastructure owner | HOST readiness, capacity, runtime, backup/restore and environment evidence |
| Security/privacy owner | FORTRESS controls, threat review, access, data protection and incident readiness |
| Commercial lead | Pipeline, partner engagement, pricing proposals and contracts |
| Finance owner | Cost model, margin, tax, invoicing, settlement and reconciliation |
| Operations/customer success | Onboarding, service desk, incident handling, customer acceptance and renewals |
| External legal/regulatory adviser | Written activity-perimeter and contract/privacy review |

A person may hold more than one role during the initial programme, but each decision must still have an explicitly recorded accountable owner. No owner may approve their own exception to a mandatory security, legal or production gate without the designated independent review.

## 10. Stage gates and delivery sequence

| Gate | Exit evidence | Decision |
|---|---|---|
| G0 — scope and ownership | Approved product boundary, named owners, dependency map and exclusions | Start controlled build |
| G1 — software readiness | Automated tests, API contract, tenant isolation, state/audit consistency, security review | Permit internal rehearsal |
| G2 — operational readiness | Support/runbooks, restore test, reconciliation, exception handling and customer terms | Permit limited software-first pilot |
| G3 — commercial readiness | Approved SKU, pricebook, unit economics, tax/legal review and signed customer terms | Permit sale of that SKU |
| G4 — provider readiness | Executed agreement, sandbox certification, serviceability, credentials, SLA and regulatory allocation | Permit provider-specific controlled pilot |
| G5 — production readiness | Authorized HOST/runtime, HTTPS/health/content, security, capacity, backups, restore and acceptance | Permit separately approved production release |
| G6 — scale decision | Observed cohort economics, customer outcomes, stable operations and risk review | Scale, revise or stop |

Gates are per SKU, provider, tenant and environment. Passing one service does not confer readiness on another.

## 11. Immediate delivery backlog

1. Reconcile the open PR stack and establish the accepted base branch before merging any dependent work.
2. Complete the I-CONNECT software-first customer/order/support workflow against the existing canonical API and persistence contracts.
3. Prove tenant/application/environment authorization and atomic state/audit/outbox persistence.
4. Complete I-PAY provider-neutral payment, ledger, webhook, idempotency and reconciliation evidence independently of I-CONNECT.
5. Complete HOST execution authorization and runtime registration; retain the deployment block until independently verified.
6. Approve the first one to three saleable software/assessment SKUs with fully costed unit economics.
7. Complete legal, privacy, tax and regulatory review for each exact activity.
8. Secure named provider owners and due-diligence packs; do not treat outreach as a contract.
9. Recruit a consenting pilot cohort only after G2 and G3 for the relevant offer.
10. Run the pilot, publish an evidence report and make a scale/revise/stop decision.

## 12. Evidence and reporting standard

Each work item must link to its source PR/commit, automated checks, test report, decision record, responsible owner and unresolved risks. Every status must use one of:

- **Specified** — written design exists.
- **Implemented** — code exists in a branch or merged repository.
- **CI-verified** — named automated checks passed on an exact commit.
- **Sandbox-verified** — tested against a provider sandbox with evidence.
- **Contracted** — executed commercial agreement exists.
- **Production-verified** — independently tested in the intended production environment.
- **Blocked** — a named dependency or failed gate prevents progression.

Do not collapse these states into a generic “complete” label.
