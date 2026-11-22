# I-CONNECT — Partner Readiness & Integration Matrix

**Programme:** IZAKHONO Open Economy  
**Default posture:** Provider-neutral and non-exclusive  
**Status:** Internal qualification and technical acceptance standard

## 1. Partner categories and proposed roles

| Category | Potential contribution | IZAKHONO retains | Required evidence before sale |
|---|---|---|---|
| Mobile network operator | Wholesale mobile connectivity, enterprise connectivity, SIM/eSIM or approved channel services | Customer experience, I-CONNECT workflow, customer relationship and platform IP subject to contract | Service scope, wholesale terms, serviceability, regulatory allocation, API/sandbox, fulfilment evidence and support SLA |
| Fibre wholesaler / open-access network | Last-mile fibre serviceability and wholesale access | Customer account, quote/order orchestration, support coordination and platform IP | Address-level serviceability, installation lead times, wholesale rates, fault process and order API |
| ISP / managed connectivity provider | Internet access, managed router, business support | Customer portal and agreed managed-service relationship | Licence/authority checks where applicable, service definition, SLA, support escalation, pricing and data terms |
| MVNE / MVNO enabler | SIM/eSIM lifecycle, numbering and mobile-core enablement where permitted | Brand and customer relationship subject to contract and law | Legal/regulatory model, sponsor/host operator agreement, technical/API certification, numbering and emergency obligations |
| Voice / SIP provider | Business voice and SIP services | Customer account, business workflows and integration layer | Numbering rights, emergency-calling responsibility, portability, call-data protection, service SLA and test evidence |
| Payment/acquiring provider | Authorised payment acceptance, acquiring, settlement or related services | I-PAY product/IP and merchant workflow within approved perimeter | Provider authorisation, underwriting, settlement/reconciliation contract, webhook/security test and complaints/refund responsibilities |
| Hosting / infrastructure supplier | Capacity or specialist infrastructure where needed | HOST architecture and customer relationship according to contract | Data location, security, backup/restore, capacity, incident, exit and subprocessor terms |

No category in this matrix indicates that a specific company has agreed to supply or resell a service.

## 2. Partner scorecard

Score each criterion 0–5 and attach documentary evidence. A missing critical item is a blocker regardless of aggregate score.

- Commercial viability: transparent wholesale rates, no unbounded minimums, stable price-change process.
- Serviceability: verifiable coverage or address-level availability for the intended cohort.
- Technical readiness: documented API, stable sandbox, versioning, signed events and support.
- Operational performance: incident severity model, support hours, escalation and fulfilment reporting.
- Regulatory allocation: clear legal roles, licences/authorisations and customer disclosures.
- Security and privacy: data minimisation, access controls, encryption, incident notification and retention.
- Customer ownership: clear branding, customer contact, complaint handling and portability rights.
- Resilience and exit: alternative routing/provider options, data export and orderly termination.

**Critical blockers:** unverifiable provider identity/authority; missing regulatory responsibility; no lawful data-sharing basis; no signed contract; unverified serviceability; insecure credentials/events; unclear customer billing; no exit path.

## 3. Canonical adapter contract

The I-CONNECT core must not depend on supplier-specific field names or state semantics. Each adapter maps provider APIs into a versioned canonical contract.

### Required commands
- `checkServiceability(location, product, correlationId)`
- `createOrder(acceptedOrder, idempotencyKey, correlationId)`
- `getOrderStatus(providerOrderId, correlationId)`
- `cancelOrder(providerOrderId, reason, idempotencyKey, correlationId)`
- `listServices(customerReference, cursor, correlationId)`
- `getUsage(serviceReference, period, correlationId)` where supported and lawful

### Required event envelope
- provider ID and provider account ID;
- provider event ID and event type;
- provider event timestamp and received timestamp;
- schema/API version;
- provider order/service reference;
- customer/tenant correlation reference that does not expose unnecessary personal data;
- signature-verification result and key/version identifier;
- normalized state and source evidence reference;
- payload hash and secure raw-evidence location where retention is justified.

Never accept a browser-supplied provider event or trust an unverified callback as proof of fulfilment.

## 4. Integration test matrix

| Scenario | Expected result | Evidence |
|---|---|---|
| Valid serviceability response | Store source, timestamp, product and location scope | Fixture + adapter test |
| Out-of-area / unavailable | Return unavailable; do not create order | Negative test |
| Duplicate create-order request | One provider order; same canonical result returned | Idempotency test |
| Same key, different request body | Reject conflict | Idempotency conflict test |
| Timeout before provider accepts | Retry only under bounded policy | Retry test |
| Timeout after provider accepts | Reconcile by immutable request/reference; do not duplicate | Recovery test |
| Valid signed event | Verify signature, freshness, account and event ID; process once | Signature + replay test |
| Duplicate event | No duplicate state transition or ledger effect | Replay test |
| Invalid signature / stale event | Reject and alert; no state mutation | Security test |
| Out-of-order event | Apply only permitted transition; otherwise reconcile/manual review | State-machine test |
| Provider says active but service reference mismatches | Manual review; never mark customer service active | Provenance test |
| Provider cancellation | Verify authoritative termination before closing service | Cancellation test |
| Tenant A requests Tenant B resource | Deny without leaking existence or metadata | Isolation test |
| Provider API unavailable | Degrade safely, preserve pending state and surface incident | Resilience test |
| Reconciliation mismatch | Open exception with evidence and owner | Reconciliation test |
| Database failure during state/audit write | Atomic rollback; no partial business success | Transaction test |

## 5. Security, data and operational controls

- Credentials live only in approved secret storage and are never returned to the browser.
- Rotate credentials and keys; record owner, scope, expiry and revocation path.
- Verify webhook signature over the exact raw body using the provider's documented algorithm and key rotation model.
- Enforce timestamp tolerance, event ID uniqueness, replay protection and rate limits.
- Minimise personal and location data; document purpose, lawful basis, retention and deletion.
- Separate production and sandbox accounts, credentials, queues and records.
- Do not allow synthetic provider events to enter production or activate a production entitlement.
- Use bounded retries, circuit breakers, dead-letter queues and an operator-owned replay process.
- Keep customer-facing service status distinct from internal provisioning job status.
- Define service desk ownership and provider escalation before customer launch.

## 6. Contract schedule checklist

Before signature, the commercial/legal owner confirms:
- exact services, geographies, eligible customer types and exclusions;
- wholesale pricing, billing unit, minimums, taxes, price-change notice and disputes;
- order acceptance, fulfilment milestones, serviceability and installation;
- service levels, support hours, incident response and service credits;
- data-controller/processor roles, permitted purposes, subprocessors, retention and cross-border transfer;
- security requirements, audit rights, breach notification and vulnerability coordination;
- customer ownership, branding, direct marketing and consent;
- regulatory responsibilities, customer disclosures and complaint routing;
- settlement/reconciliation where money flows through a partner;
- IP ownership, licences, confidentiality and restricted technical disclosure;
- liability, indemnities, insurance, suspension, termination and transition assistance;
- portability, data export, API deprecation and orderly exit.

## 7. Provider-specific engagement state

Use only these states: Identified → Contacted → Routed → Discovery → Due diligence → Sandbox → Contracting → Certified → Production eligible → Suspended / Exited.

A state change requires a dated evidence reference and named owner. An email acknowledgement is evidence of receipt only; it is not discovery, due diligence, contract or production eligibility.
