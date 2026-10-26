# IZAKHONO Communications OS — Owned SIP Runtime

This directory defines the deployment boundary for the IZAKHONO-owned SIP runtime.

## Ownership model

- Communications OS control plane owns tenants, extensions, routing intent, billing and policy.
- The SIP runtime owns SIP registration, session handling, media and runtime configuration.
- PSTN/carrier interconnect remains a replaceable external edge until an owned interconnect is available.
- GitHub is source/mirror infrastructure; runtime state is not stored in Git.

## Deployment contract

A deployment must provide:

1. A reproducible SIP runtime image or installation artifact.
2. Persistent configuration and secret references outside source control.
3. Private administration access and an explicit network policy.
4. SIP signalling and media ports appropriate to the selected runtime.
5. TLS/SRTP where supported and required by policy.
6. A health/readiness endpoint or equivalent probe.
7. A controlled connection to the Communications OS control plane.
8. Runtime reconciliation on startup and after configuration changes.
9. CDR/audit persistence through the control-plane persistence boundary.
10. Restart/recovery behavior that re-applies desired state safely.

## Required environment contract

The runtime deployment consumes the configuration defined by `src/runtime-config.ts`:

- `IZAKHONO_COMMUNICATIONS_RUNTIME`
- `IZAKHONO_SIP_DOMAIN`
- `IZAKHONO_SIP_BIND_ADDRESS`
- `IZAKHONO_SIP_PUBLIC_ADDRESS`
- `IZAKHONO_SIP_TLS_ENABLED`
- `IZAKHONO_SIP_SECRET_REF`
- `IZAKHONO_CARRIER_SECRET_REF` (only when a carrier edge is configured)
- `IZAKHONO_DATABASE_URL`

Secrets must be injected through the runtime secret mechanism. They must never be committed to this repository, embedded in images, returned by API responses, or written to ordinary logs.

## Readiness gate

The runtime is **not production/live** until evidence exists for:

- successful runtime health/readiness;
- extension provisioning and SIP registration;
- inbound routing;
- outbound routing;
- CDR/audit persistence;
- restart and reconciliation;
- backup/restore procedure;
- controlled carrier registration;
- a verified inbound PSTN call;
- a verified outbound PSTN call.

A source-level deployment definition is not evidence that any of these runtime paths are operational.
