# IZAKHONO CONNECT — Mobile Operator & Network Architecture

**Decision:** South Africa first; build both the branded mobile operator capability and the long-term owned-network capability. Software, intellectual property, subscriber experience, billing, orchestration and security are IZAKHONO-owned. Network access is replaceable until the owned radio/network estate is legally and technically viable.

## 1. Product boundary

I-CONNECT is the retail brand and operating platform. It is not itself a radio network merely because its software can create a SIM record or display a data package.

The platform supports two delivery models:

- **MVNO / MVNE partner model:** I-CONNECT owns the brand, customer account, plans, app, customer support, billing experience, analytics, provisioning orchestration and provider-neutral adapter layer. A licensed host network/MVNE supplies radio access and wholesale mobile service under a documented agreement.
- **Owned network model:** IZAKHONO progressively owns and operates the mobile core, subscriber database, policy/charging, service orchestration, NOC and (where separately authorised and funded) radio access, spectrum rights, backhaul and interconnection.

The delivery model is explicit on every service and order. No simulator, aggregator catalogue, or unapproved supplier is treated as a live mobile network.

## 2. Software IZAKHONO owns

| Domain | Owned software responsibility |
|---|---|
| Digital channels | Customer PWA/app, reseller portal, enterprise portal, self-service and support |
| Identity | Subscriber identity, organisation tenancy, role-based access, MFA, KYC/RICA workflow references |
| Product | Mobile plans, data bundles, airtime denominations, eSIM/SIM inventory, eligibility and price books |
| Order management | Quotes, checkout intents, order state, idempotency, retries, cancellation and exception queue |
| BSS | Customer account, billing, prepaid/postpaid rating, invoices, balances, payments, refunds and settlement reconciliation |
| OSS | Service inventory, SIM/eSIM lifecycle, activation, suspension, resume, termination, usage and network fault correlation |
| Orchestration | Provider-neutral adapter contract, routing, health checks, fallback, webhook inbox and reconciliation |
| Security | FORTRESS policy, audit trails, fraud rules, secrets isolation, rate limits and operator approvals |
| Analytics | Usage, service quality, margin, wholesale cost, churn, revenue and partner performance |
| Owned mobile core (later) | Subscriber data integration, authentication, session/policy control, charging, service exposure and network management interfaces |

## 3. Network architecture

```text
I-CONNECT App / Web / USSD / Reseller / Enterprise
                    |
          IZAKHONO API Gateway
                    |
    Identity + KYC/RICA + FORTRESS + Consent
                    |
       Product Catalogue + Price Book
                    |
       Order / Billing / Payment Ledger
                    |
     Mobile Service Orchestration & OSS/BSS
                    |
          Provider Adapter Gateway
             /             \
      MVNO/MVNE partner   Owned-network adapter
             |             |
       Host mobile RAN   IZAKHONO mobile core
       + host core       + subscriber/authentication
       + wholesale       + policy/charging
       service            + interconnect/backhaul
                              |
                       Radio access network
                       only with spectrum,
                       site and equipment rights
```

## 4. Mobile core capabilities (owned-network workstream)

The owned-network adapter must eventually integrate the following independently testable systems:

- Subscriber identity and authentication (SIM/eSIM credentials, HSS/UDM/AUSF interfaces).
- 4G/5G control and user plane (EPC/5GC, AMF, SMF, UPF and session lifecycle).
- Policy and charging (PCRF/PCF, OCS/CHF, quota, balance, rating and usage records).
- IMS/voice and SMS interworking where voice/SMS is offered.
- SIM/eSIM lifecycle and profile fulfilment, with certified provisioning and key custody.
- RAN/site inventory, radio telemetry, capacity, alarms and network optimisation.
- IP transit, backhaul, peering, lawful obligations and emergency-service interfaces where applicable.
- NOC, incident response, backups, disaster recovery and security monitoring.

These are integration boundaries and acceptance requirements, not a claim that a live RAN or mobile core has already been deployed.

## 5. South African compliance gates

Before commercial activation, obtain a documented legal/regulatory classification for the exact operating model. ICASA describes licensing categories for ECS and ECNS, licence-exempt resale conditions, and individual licensing requirements for some services including voice telephony using numbers from the national numbering plan. The regulatory position must be confirmed for the proposed I-CONNECT structure, services and partner arrangement.

For an owned network, confirm the necessary ECS/ECNS authorisations, spectrum rights, type-approved radio equipment, numbering/interconnection, consumer protection, lawful obligations and emergency-service requirements before any radio transmission or customer launch.

RICA and POPIA workflows must be designed into subscriber onboarding, data retention, consent, access control, breach handling and audit. Store references and verification outcomes; do not store raw identity documents or SIM secrets in ordinary application tables.

Regulatory references:
- ICASA Services Licensing: https://www.icasa.org.za/pages/services-licencing
- ICASA Licensing: https://www.icasa.org.za/pages/licensing
- ICASA Telecommunications: https://www.icasa.org.za/pages/telecommunications
- Electronic Communications Act: https://www.gov.za/documents/electronic-communications-act

This document is an engineering control, not legal advice or a licence application.

## 6. Provider readiness and commercial rules

A provider is not production-eligible merely because it appears in the registry or exposes a public API. Required evidence includes:

1. Executed agreement and white-label/customer ownership terms.
2. Approved wholesale pricebook and commercial settlement terms.
3. Technical API specification and authenticated sandbox access.
4. Verified coverage/product feed and fulfilment rules.
5. RICA/KYC allocation and support escalation.
6. Production credentials stored in a secrets manager.
7. Test orders, status reconciliation, refund/failed-order handling and signed webhooks.
8. Formal internal production approval and regulatory review.

MobiSIM is currently a read-only integration for account/catalogue lookup and webhook reconciliation. Its purchase, top-up, wallet and live provisioning operations remain disabled until partner approval, pricebook, credentials, funded terms and test evidence are received.

## 7. Release sequence

### Wave A — owned digital platform
Complete the customer/reseller experience, mobile product catalogue, order engine, billing ledger, usage model, provider gateway, KYC/RICA workflow, FORTRESS audit and reconciliation. Use synthetic data only in sandbox.

### Wave B — commercial MVNO
Select the strongest host-network/MVNE proposal, execute agreement, complete API certification and RICA/customer support allocation, then enable a limited production cohort after acceptance.

### Wave C — network sovereignty
Build and validate an owned mobile-core lab and network operations stack. Conduct lab and field trials only under lawful spectrum/test arrangements. Model RAN, sites, backhaul, interconnection, power, resilience, capex and ongoing NOC costs.

### Wave D — selective owned footprint
Deploy owned network infrastructure only where licences/spectrum, coverage economics, site access, backhaul and demand justify it. Retain roaming/host-network fallback where needed.

## 8. Non-negotiable acceptance criteria

- No production service without provider/network and regulatory approval.
- No service marked ACTIVE without verified upstream or owned-core confirmation.
- All money is integer minor units (ZAR cents); no floating-point balances.
- Every order has an idempotency key and immutable audit trail.
- Provider secrets never reach the browser or source control.
- Webhooks require signature verification, replay protection and reconciliation.
- Simulator data is visibly labelled and isolated from production.
- Failed or uncertain transactions go to a manual-review queue; never silently retry a charge.
- Customer pricing is approved from evidenced costs and margin rules.
- Software ownership does not imply ownership of spectrum, radio access or wholesale network capacity.
