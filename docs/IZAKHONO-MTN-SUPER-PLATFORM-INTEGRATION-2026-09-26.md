# IZAKHONO × MTN: Super-Platform Integration Plan

Date: 2026-09-26

## Objective

Build IZAKHONO as its own independent super-platform while integrating with MTN where the relationship expands distribution, payments, identity, merchant reach and African scale. MTN remains a replaceable external partner; IZAKHONO-owned engines, customer relationships and data boundaries remain authoritative.

## Immediate technical integration

1. Add MTN MoMo Collections as an optional IZAKHONO PAY rail.
2. Keep the integration non-custodial: MTN/MoMo remains the regulated payment rail and settlement provider; IZAKHONO PAY orchestrates requests and records transaction state.
3. Use MTN's asynchronous RequestToPay pattern. A payment is never marked paid from an unauthenticated callback alone; IZAKHONO PAY confirms final status directly with MTN before entitlement or fulfilment.
4. Store MTN credentials only in the approved secret store. Do not commit subscription keys, API users or API keys.
5. Production activation remains blocked until MTN onboarding, KYC/contracting, production endpoints, callback registration, security review and end-to-end acceptance are complete.

## Partnership routes to pursue

### A. MoMo merchant + API partner
Use Collections for checkout across FAISReady, KORA, EDU-BUILD commerce, Creative Suite and other eligible IZAKHONO services. Add Disbursements only after the commercial and regulatory use case is approved.

### B. MoMo Mini Apps / super-app distribution
Package selected IZAKHONO services as MoMo mini apps or PWAs where MTN approves them. Priority candidates:
- WorkNow: jobs, verified candidate readiness and training hand-off
- FAISReady: regulated-industry exam preparation, not financial advice
- EDU-BUILD public enrolment/shop surfaces
- KORA commerce/ticketing and artist services
- AUTO AI and practical consumer utilities

Each mini app must remain independently deployable and use IZAKHONO ID/CRM only within agreed consent, privacy and MTN platform rules.

### C. MTN Developer Platform APIs
Evaluate South Africa-enabled APIs for KYC verification, customer identification/profile, messaging, location and merchant provisioning only where a concrete product need exists and consent/legal basis is documented. Do not build surveillance or behavioural tracking.

### D. Strategic partnership
Pitch IZAKHONO as an African digital-services portfolio that can supply useful mini apps, merchant demand, SME enablement, education, employment and creator-economy services into MTN's digital ecosystem. The ask should be distribution + technical onboarding + joint go-to-market, not dependence or exclusivity.

## Commercial proposition to MTN

IZAKHONO brings a portfolio rather than one app: education, work, creator economy, merchant tooling, AI utilities, commerce and fraud-prevention capabilities. MTN brings reach, connectivity, MoMo, APIs and distribution. The partnership should target measurable active users, transactions, merchant adoption and service usage while keeping transaction volume, revenue and valuation reported separately.

## First meeting ask

- MoMo Collections production onboarding for South Africa.
- Access to the MoMo Mini App programme and technical review.
- A developer/solution-architect contact for South Africa API products.
- Guidance on the correct commercial route for multi-product integration.
- Discussion with MTN Group Fintech / digital-platform teams on piloting 2–3 IZAKHONO mini apps.
- Clarification of approved customer-data fields, consent requirements, data-residency requirements and production callback/security controls.

## Go-live gates

No MTN-connected capability may be called live until:
- MTN account and product subscription are approved;
- contractual/KYC onboarding is complete;
- production credentials and endpoint/target-environment values are issued;
- HTTPS callback host is registered;
- payment status confirmation passes end to end;
- reconciliation is verified;
- privacy notices and data-processing terms are approved;
- FORTRESS monitoring is enabled without replacing MTN or statutory controls.

## Pilot

Pilot 1: MTN MoMo checkout through IZAKHONO PAY on one low-risk digital product.

Pilot 2: Submit WorkNow or FAISReady as a MoMo Mini App candidate.

Pilot 3: Measure conversion, payment success, active users and support load before expanding to the broader portfolio.
