# IZAKHONO Communications OS — Asterisk Runtime Adapter

Asterisk is the first concrete SIP engine target for the owned IZAKHONO communications runtime.

## Why Asterisk

Asterisk provides the SIP/PJSIP runtime required for extension registration, call routing and media handling while leaving the IZAKHONO Communications OS control plane in charge of tenants, identity, provisioning, policy, billing and audit.

The runtime targets `res_pjsip`/`chan_pjsip`, not the legacy `chan_sip` driver.

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

## Runtime artifact

The repository now contains a source-built, pinned Asterisk runtime image:

- Asterisk `22.11.0`
- Source SHA-256: `3bd5ee040509a3d3cd9b1ba9520c18e6ec0a7e7981ca68c457dcd36ba3c54d94`
- Bundled PJSIP/pjproject build path
- Non-root `asterisk` runtime user
- Controlled SIP/RTP ports
- Docker healthcheck
- No floating `latest` dependency

The version and checksum are recorded in `Dockerfile` and `docker-compose.yml`. The Asterisk project release index currently lists 22.11.0 as the 22-series release artifact. This repository has not yet produced evidence of a successful image build on an owned runtime node.

## Generated configuration boundary

`src/asterisk-config.ts` renders tenant PJSIP credentials and managed route fragments. The renderer accepts a resolved secret only at the final config boundary; secrets are not part of the desired-state model and are not returned by diagnostics.

The runtime templates load generated fragments from:

- `/etc/asterisk/pjsip.d/*.conf`
- `/etc/asterisk/extensions.d/*.conf`

The static baseline deliberately contains no unrestricted PSTN dial pattern.

## Security baseline

- Never commit SIP passwords, carrier credentials or database credentials.
- Pass secrets by secret reference and resolve them only at runtime.
- Prefer TLS for SIP signalling where supported and SRTP for media where supported by the endpoint path.
- Restrict management interfaces to private administration networks.
- Apply rate limits and fraud controls before enabling external PSTN traffic.
- Do not enable emergency calling until the jurisdiction-specific emergency-call policy, routing and customer disclosure requirements have been implemented and verified.
- Runtime containers use `no-new-privileges` and drop Linux capabilities in the supplied deployment manifest.

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
