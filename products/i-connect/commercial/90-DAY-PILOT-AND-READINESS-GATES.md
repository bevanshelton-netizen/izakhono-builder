# I-CONNECT — 90-Day Pilot Plan & Readiness Gates

**Status:** Proposed delivery plan; start date follows owner approval and resource assignment  
**Pilot market:** South Africa  
**Initial cohort:** Target 20–50 businesses, subject to support capacity  
**Principle:** Prove a useful software-led service before activating regulated or provider-dependent services.

## 1. Pilot objective

Validate that IZAKHONO can acquire, onboard, support and retain business customers for a defined software and infrastructure service bundle, with transparent costs and positive contribution margin. Live carrier fulfilment is not a prerequisite for proving the customer platform.

## 2. Pilot scope

### In scope, once individually accepted
- organisation and user onboarding;
- FORTRESS-backed access and role controls;
- service catalogue and versioned quote flow;
- customer support requests and status;
- service inventory and evidence display;
- infrastructure assessment and project delivery workflow;
- HOST-backed services only after physical production acceptance;
- invoice and payment workflow only after I-PAY/payment-provider release approval;
- partner directory and provider readiness dashboard.

### Out of scope until separate gates pass
- live SIM/eSIM sale or activation;
- airtime/data top-up or wholesale carrier charging;
- PSTN voice, public numbering or emergency call routing;
- SMS delivery represented as carrier-confirmed;
- satellite service fulfilment;
- automatic network failover;
- owned RAN/mobile-core operation;
- public DNS or customer domain cutover without explicit approval.

## 3. Work plan

### Days 1–15: verify foundation
- inventory current I-CONNECT, HOST, PROVISIONER, FORTRESS and I-PAY features;
- map implemented versus specified versus deployed versus production-verified;
- inspect existing API contracts and database ownership;
- define customer journeys, support ownership and service catalogue;
- create cost model and pricebook approval workflow;
- complete South African legal/regulatory review brief;
- identify pilot businesses and obtain permission for discovery.

Exit evidence: signed scope, owner matrix, risk register, cost assumptions, approved pilot offer and explicit service exclusions.

### Days 16–30: complete software-first workflow
- customer/organisation onboarding and tenant authorization;
- service catalogue, quote and order state;
- support ticket and incident workflow;
- service status and evidence references;
- scoped idempotency, transactional outbox/inbox and audit consistency;
- operational dashboards and reconciliation;
- security tests and customer acceptance scripts.

Exit evidence: passing automated tests, security review, tenant-isolation tests, replay/idempotency tests and user acceptance.

### Days 31–45: internal operational rehearsal
- create internal test tenants;
- simulate quotes/orders with clearly labelled synthetic providers;
- rehearse exception queue, refunds in sandbox, cancellation and support escalation;
- verify no synthetic success can mark production service ACTIVE;
- test backup/restore for relevant systems and operational runbooks.

Exit evidence: signed rehearsal report, no unresolved critical/high defects, support runbook and recovery evidence.

### Days 46–60: controlled customer pilot
- onboard a limited number of consenting businesses;
- sell only approved assessments, implementation or software features that are genuinely available;
- do not charge for unavailable features;
- measure onboarding completion, support burden, adoption and willingness to pay;
- collect feedback and resolve defects.

Exit evidence: customer acceptance, accurate billing, reconciled costs, support metrics and documented issues.

### Days 61–75: provider integration certification (conditional)
Only proceed if a provider enters formal due diligence and supplies a sandbox/contract path:
- verify provider legal entity and service scope;
- validate wholesale pricebook and serviceability;
- implement provider adapter against approved API contract;
- test signed webhooks, idempotency, reconciliation, cancellation and exception states;
- complete compliance allocation and security review.

If no provider is approved, continue the software-first pilot; do not invent an integration or present demo data as live.

### Days 76–90: commercial review and scale decision
- calculate per-customer contribution margin and cost-to-serve;
- evaluate retention, support, conversion and product usage;
- evaluate provider scorecard and concentration risk;
- review legal, security, HOST and payment gates;
- approve, revise or stop each product SKU independently.

Exit evidence: owner decision record, updated pricebook, product roadmap, operating budget and next-cohort authorization.

## 4. Mandatory readiness gates

### Gate A — corporate and legal
Legal entity, tax, customer terms, privacy notices, data-processing terms, service descriptions, consumer disclosures and relevant licensing classification verified.

### Gate B — infrastructure
HOST environment and physical execution interface authorised; runtime and node registration verified; public reachability and TLS/DNS acceptance completed where needed; capacity and isolation reviewed; backups and restore tested; monitoring and incident ownership assigned.

### Gate C — security
FORTRESS identity, MFA, tenant authorization, least privilege, secrets, audit, vulnerability review, incident response and data retention controls accepted.

### Gate D — payments
I-PAY/payment provider approved; merchant underwriting and provider terms complete; signed webhook validation, replay protection, ledger, refunds, disputes and settlement reconciliation tested. Real billing remains disabled until accepted.

### Gate E — carrier/provider
Executed agreement, exact service scope, approved pricebook, regulatory responsibilities, API certification, production credentials, coverage/serviceability, end-to-end fulfilment and support escalation accepted.

### Gate F — customer operations
Sales scope, onboarding, support hours, incident severity, escalation, customer communications, cancellation and service handover documented and rehearsed.

A service is enabled only when every applicable gate is green. Gate status is recorded per SKU, environment and provider; no blanket readiness flag.

## 5. Pilot scorecard

Measure qualified leads and conversion; onboarding completion and time; active paid subscriptions (exclude trials); collected revenue versus invoices; software gross margin; connectivity contribution margin separately; customer acquisition cost and payback; cost-to-serve and support tickets per customer; provisioning success based on authoritative upstream evidence; time to verified fulfilment; churn, cancellation, refund and dispute rates; security incidents and unresolved vulnerabilities; HOST backup/restore and availability evidence.

Set numerical targets after baseline and unit economics are known; do not invent guaranteed outcomes.

## 6. Stop conditions

Pause affected sales or provisioning if:
- provider or customer serviceability is uncertain;
- customer billing differs from approved quote;
- payment/settlement cannot be reconciled;
- tenant isolation or privileged access defect is found;
- provider webhook signatures or replay controls fail;
- HOST or data recovery cannot be demonstrated;
- regulatory or privacy concern is raised;
- the service cannot meet its published terms.

## 7. Decision after 90 days

Scale only products with verified delivery, positive or explicitly approved contribution margin, acceptable customer outcomes, stable operations and complete legal/security evidence. Retire or redesign products that fail these tests.
