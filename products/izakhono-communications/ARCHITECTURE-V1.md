# IZAKHONO COMMUNICATIONS OS™ — Architecture V1

## Mission

Build an owned-first, carrier-independent business communications platform. IZAKHONO owns the control plane, provisioning, customer experience, APIs, security model, data model and original orchestration/IP. Telephony engines and carriers are replaceable adapters.

## System boundary

```text
IZAKHONO ONE
    |
    v
Communications Control Plane
    |
    +-- Identity / Tenants / RBAC
    +-- Number Inventory
    +-- Extensions / Devices
    +-- Routing / IVR / Queues
    +-- Billing / Entitlements
    +-- CDR / Analytics
    +-- Provisioning Jobs
    +-- AI Orchestration
    +-- Audit / Policy / FORTRESS
    |
    v
Carrier Abstraction Layer
    |
    +-- SIP carrier adapters
    +-- Number provisioning adapters
    +-- SMS/WhatsApp adapters
    +-- Emergency-services adapter
    |
    v
Telephony Runtime
    |
    +-- SIP engine adapter
    +-- WebRTC gateway
    +-- Media/recording services
    |
    v
PSTN / Mobile / Internet
```

## Ownership rule

1. IZAKHONO control-plane code is proprietary unless explicitly marked otherwise.
2. Third-party components retain their original licences and notices.
3. Carrier services are infrastructure dependencies, not IZAKHONO-owned IP.
4. Every dependency must be recorded with licence/provenance information.
5. Carrier and telephony adapters must be replaceable without changing customer-facing business logic.

## V1 domain model

- `tenants`
- `users`
- `roles`
- `extensions`
- `devices`
- `phone_numbers`
- `routing_rules`
- `ivr_menus`
- `queues`
- `call_records`
- `recordings`
- `provisioning_jobs`
- `carrier_connections`
- `subscriptions`
- `audit_events`

Every tenant-owned record is scoped by `tenant_id` and protected by authorization policy.

## Provisioning state machine

`REQUESTED → PAYMENT_CONFIRMED → TENANT_CREATED → NUMBER_ASSIGNED → EXTENSIONS_CREATED → ROUTING_CONFIGURED → DEVICES_ISSUED → SERVICE_VALIDATED → ACTIVE`

Any failure enters `REQUIRES_ATTENTION` with an auditable reason. Provisioning must be idempotent and resumable.

## Carrier abstraction

The control plane must call capabilities, not carrier-specific APIs directly. Example capabilities:

- `searchNumbers`
- `reserveNumber`
- `releaseNumber`
- `portNumber`
- `createSipCredential`
- `configureInboundRoute`
- `configureOutboundRoute`
- `getUsage`
- `healthCheck`

Adapters implement these capabilities for individual carriers.

## Security baseline

- FORTRESS-compatible authentication and authorization
- MFA for privileged users
- tenant isolation
- encrypted secrets
- server-side carrier credentials only
- immutable audit events
- least-privilege service accounts
- call-recording retention policies
- fraud/anomaly detection hooks
- emergency-call policy controls

## AI boundary

AI may recommend, classify, summarise or execute approved communication workflows. High-impact actions require explicit policy controls. AI must not silently invent customer/account information or represent unverified emergency/regulatory capabilities as operational.

## World-first innovation track

Potential proprietary innovation areas are maintained separately from the commodity PBX layer:

1. zero-touch business communications provisioning
2. intent-aware communications routing
3. cross-channel conversation identity
4. communications memory with consent/retention controls
5. adaptive carrier failover
6. autonomous service-health remediation with owner gates
7. unified business identity across voice, messaging, email and AI

These are candidates for invention review, prior-art research and possible patent/trade-secret protection; no novelty claim is made until verified.

## Readiness gate

A service is not labelled production/live until number provisioning, inbound/outbound calls, routing, recording, security, backup/restore, carrier failover and customer acceptance have independently verified evidence.
