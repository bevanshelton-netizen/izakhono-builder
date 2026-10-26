# IZAKHONO Communications Runtime

This directory defines the deployment boundary for the IZAKHONO-owned SIP runtime.

## Ownership model

- **IZAKHONO control plane:** tenants, extensions, numbers, routing, policy, billing, audit and desired state.
- **IZAKHONO SIP runtime:** SIP registration/authentication, signalling, media/session handling, extension and route configuration, health/readiness.
- **Carrier/PSTN edge:** replaceable external interconnect for public telephone numbers and PSTN termination.

The runtime must remain deployable without making a carrier the system of record.

## Deployment contract

1. Provision an IZAKHONO-owned runtime node.
2. Install the selected SIP runtime from a reproducible, version-pinned artifact.
3. Restrict administrative access and expose only required signalling/media ports.
4. Configure TLS/SRTP where supported by the selected runtime and client path.
5. Load configuration through `runtime-config.ts`; credentials are references, not source values.
6. Connect to IZAKHONO PostgreSQL through `IZAKHONO_DATABASE_URL`.
7. Register the runtime with the Communications control plane.
8. Reconcile desired extensions and routes with `RuntimeReconciler`.
9. Verify health, readiness, extension registration, route state and audit/CDR persistence.
10. Attach a carrier/PSTN adapter only after the owned runtime passes its readiness gate.

## Required readiness evidence

A deployment is not considered live until evidence exists for:

- SIP listener and runtime health.
- TLS certificate and signalling policy where enabled.
- Database connectivity and persistence.
- Extension provisioning and registration.
- Inbound and outbound route reconciliation.
- Controlled restart followed by successful reconciliation.
- No secrets in logs or API responses.
- Backup/restore procedure.
- Carrier authentication, assigned number, inbound call, outbound call, caller ID, CDR and disconnect/reconnect behaviour when PSTN is enabled.

## Rollback

Runtime configuration changes must be versioned and reversible. Failed reconciliation must not silently delete desired state. Carrier changes must be independently reversible from the owned runtime deployment.

## Current status

**Source-defined / not live.** The repository contains the runtime contract and reconciliation layer. Actual node provisioning, SIP runtime installation, network exposure, carrier interconnect and real call evidence still require execution and verification on an IZAKHONO-owned runtime environment.
