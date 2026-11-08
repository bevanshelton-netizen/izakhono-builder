# I-CONNECT Corporate Command

I-CONNECT is the corporate communications and connectivity control plane for the IZAKHONO ecosystem.

## Product scope
- Corporate contact centre: IVR, queues, agent desktop, supervisor wallboard, analytics and omnichannel-ready architecture.
- Fleet: tracking, driver communications, safety events, control-room workflows and IZAKHONO NAV/FORTRESS integration.
- Connectivity: fibre/broadband, managed Wi-Fi, mobile data, airtime, SIM/eSIM lifecycle and 5G/LTE resilience.
- Mobile operator: provider-neutral mobile products, subscriber lifecycle, KYC/RICA workflow, data/airtime orders, usage rating, prepaid/postpaid billing and reseller distribution.
- Owned-network workstream: software interfaces for subscriber identity, mobile core, policy/charging, interconnect, RAN operations and NOC; radio access and spectrum remain separately authorised infrastructure.
- Billing: one customer account, recurring subscriptions, usage rating and carrier-cost allocation.
- IZAKHONO Provisioner: payment -> verified job -> idempotent provisioning -> retries -> exception queue -> customer handover.
- FORTRESS: identity, MFA/SSO, role-based access, audit, fraud and security controls.

## Ownership strategy
IZAKHONO owns the customer channels, source code, subscriber experience, product catalogue, pricing logic, billing ledger, provisioning orchestration, security controls and provider adapters. South Africa is the first market. The delivery model is explicitly either MVNO/MVNE partner or owned network; these models are not conflated.

The mobile operator and network architecture, regulatory gates and phased roadmap are documented in `MOBILE-OPERATOR-ARCHITECTURE.md`. Mandatory FORTRESS security principles, threat model and release gates are documented in `SECURITY-ARCHITECTURE.md`. The phone-first emergency communications, fallback routes, delivery-state semantics and release gates are documented in `EMERGENCY-COMMUNICATIONS-RESILIENCE.md`. Fail-closed mobile lifecycle rules are implemented in `network/mobile-operator-core.mjs`; emergency route selection and evidence-backed delivery transitions are implemented in `network/emergency-communications-core.mjs`.

## Important production boundary
The command centre and software control plane do not themselves create radio coverage. Public numbering, carrier interconnect, mobile/fibre fulfilment, regulated voice services and emergency/recording workflows require the relevant South African authorisations, carrier agreements and compliance controls before production activation. Carrier integrations are intentionally represented as adapters so I-CONNECT is not locked to one network.

No supplier is represented as signed, approved, integrated or live until documentary and technical evidence exists. The MobiSIM integration is currently read-only for account/catalogue lookup and webhook reconciliation; purchasing, top-ups and production provisioning are disabled pending commercial approval, credentials, pricebook and certification.

## Security and release rules
- No production secrets committed to source control.
- Provider credentials remain server-side.
- No simulated supplier response may be presented as real coverage, ordering or activation.
- Production service activation requires regulatory review, approved commercial terms, provider/network certification and verified end-to-end acceptance.
- All money is stored in integer ZAR cents.
- Orders are idempotent; uncertain transactions are reconciled before retry.
