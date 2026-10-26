# IZAKHONO Communications OS — Asterisk Runtime Adapter

Asterisk is the first concrete SIP engine target for the owned IZAKHONO communications runtime.

## Why Asterisk

Asterisk provides the SIP/PJSIP runtime required for extension registration, call routing and media handling while leaving the IZAKHONO Communications OS control plane in charge of tenants, identity, provisioning, policy, billing and audit.

The current Asterisk documentation identifies PJSIP as the standard SIP driver and recommends it for new installations. The runtime therefore targets `res_pjsip`/`chan_pjsip`, not the removed legacy `chan_sip` driver.

## Boundary

```text
IZAKHONO Communications Control Plane
        |
        | desired state / reconciliation
        v
IZAKHONO Runtime Adapter
        |
        v
Asterisk + PJSIP
        |
        +---- SIP/WebRTC endpoints
        |
        +---- optional carrier/PSTN adapter
```

Asterisk is an infrastructure component, not the customer-facing source of truth.

## Runtime responsibilities

- SIP endpoint registration and authentication
- PJSIP endpoint/AoR configuration
- inbound and outbound dial-plan execution
- media/session handling
- runtime health/readiness
- controlled configuration reload/reconciliation

## IZAKHONO responsibilities

- tenant isolation
- extension identity
- provisioning state machine
- number inventory
- routing policy
- billing/entitlements
- CDR and audit persistence
- FORTRESS security policy
- carrier abstraction
- AI/automation policy

## Security baseline

- Never commit SIP passwords, carrier credentials or database credentials.
- Pass secrets by secret reference and resolve them only at runtime.
- Prefer TLS for SIP signalling where supported and SRTP for media where supported by the endpoint path.
- Restrict management interfaces to private administration networks.
- Apply rate limits and fraud controls before enabling external PSTN traffic.
- Do not enable emergency calling until the jurisdiction-specific emergency-call policy, routing and customer disclosure requirements have been implemented and verified.

## Version policy

Pin the Asterisk image/source version rather than using a floating `latest` tag. The selected version must be recorded in the deployment manifest and upgraded deliberately.

At the time this adapter was designed, Asterisk 22 is an LTS release with support through 2029, while Asterisk 24 is the newly released LTS series. A deployment may select the appropriate supported release after runtime compatibility testing; this repository does not claim that any particular version is deployed yet.

## Readiness gate

A runtime is not considered live until all of the following have evidence:

1. Asterisk starts successfully from the pinned deployment artifact.
2. PJSIP is loaded and the SIP listener is reachable only through approved network paths.
3. An extension can register with controlled credentials.
4. Inbound extension routing works.
5. Extension-to-extension calling works.
6. Outbound carrier routing works against a real authorized carrier connection.
7. Inbound PSTN routing works against an assigned number.
8. CDR/audit records persist to the IZAKHONO control plane.
9. Restart and reconciliation restore the intended configuration.
10. Secrets are absent from source, logs and client responses.

Until those checks are completed, status remains **runtime integrated in source / not production-live**.
