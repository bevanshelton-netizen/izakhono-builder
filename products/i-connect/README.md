# I-CONNECT Corporate Command

I-CONNECT is the corporate communications control plane for the IZAKHONO ecosystem.

## Product scope
- Corporate contact centre: IVR, queues, agent desktop, supervisor wallboard, analytics and omnichannel-ready architecture.
- Fleet: tracking, driver communications, safety events, control-room workflows and IZAKHONO NAV/FORTRESS integration.
- Connectivity: fibre/broadband, managed Wi-Fi, mobile data, airtime and 5G/LTE resilience.
- Billing: one customer account, recurring subscriptions, usage rating and carrier-cost allocation.
- IZAKHONO Provisioner: payment -> verified job -> idempotent provisioning -> retries -> exception queue -> customer handover.
- FORTRESS: identity, MFA/SSO, role-based access, audit, fraud and security controls.

## Important production boundary
This command centre is the deployable control-plane UI and product operating model. Public numbering, carrier interconnect, mobile/fibre fulfilment, regulated voice services and emergency/recording workflows require the relevant South African authorisations, carrier agreements and compliance controls before production activation. Carrier integrations are intentionally represented as adapters so I-CONNECT is not locked to one network.

## Build direction
1. Connect the existing IZAKHONO Provisioner backend and event/job model.
2. Add authenticated corporate tenancy and RBAC.
3. Connect billing/payment webhooks.
4. Add SIP/voice provider adapters and carrier abstraction.
5. Add fleet telemetry/NAV adapters.
6. Add CRM/ERP connectors.
7. Add production observability, security policies and disaster recovery.

The UI is deliberately usable without live carrier credentials so product, sales and operational workflows can be demonstrated while regulated/network integrations are completed.
