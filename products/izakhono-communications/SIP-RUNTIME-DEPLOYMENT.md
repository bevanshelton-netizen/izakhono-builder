# IZAKHONO COMMUNICATIONS OS™ — Owned SIP Runtime Deployment Gate

## Objective

Define the controlled deployment boundary between the Communications control plane and an IZAKHONO-owned SIP runtime.

The runtime is an owned infrastructure component. A carrier/PSTN provider is an edge dependency only; the control plane must remain portable.

## Runtime responsibilities

The SIP runtime must provide:

- SIP registration/authentication for provisioned extensions.
- Extension lifecycle provisioning and removal.
- Inbound number-to-extension/queue routing.
- Outbound policy and carrier routing.
- Media/session handling according to the selected runtime design.
- Health and readiness reporting.
- Controlled configuration reload/reconciliation.
- Operational logs without exposing SIP secrets.

## Configuration contract

Required runtime configuration is supplied through the deployment environment or an approved secret store. No SIP passwords, carrier credentials, private keys or database credentials belong in source code, test fixtures, browser bundles or ordinary logs.

Minimum configuration categories:

- `IZAKHONO_COMMUNICATIONS_RUNTIME`
- `IZAKHONO_SIP_DOMAIN`
- `IZAKHONO_SIP_BIND_ADDRESS`
- `IZAKHONO_SIP_PUBLIC_ADDRESS`
- `IZAKHONO_SIP_TLS_ENABLED`
- `IZAKHONO_SIP_SECRET_REF`
- `IZAKHONO_CARRIER_SECRET_REF`
- `IZAKHONO_DATABASE_URL`

Actual variable names may be adapted by the deployment implementation, but the security properties are mandatory.

## Deployment sequence

1. Provision an IZAKHONO-owned runtime node.
2. Install the selected SIP runtime through a reproducible deployment definition.
3. Establish private administration access and host firewall policy.
4. Configure SIP signalling and media boundaries.
5. Configure TLS/SRTP where supported by the selected runtime and device path.
6. Connect the runtime to IZAKHONO PostgreSQL through the approved repository boundary.
7. Load secrets from the approved secret mechanism.
8. Register the runtime with the Communications control plane.
9. Reconcile extensions and routes from the control plane.
10. Run readiness checks.
11. Connect a controlled carrier/PSTN edge only after the owned runtime passes internal checks.
12. Execute inbound and outbound test calls.
13. Capture evidence before declaring the service operational.

## Readiness checks

A runtime is ready only when all applicable checks pass:

- process/runtime healthy;
- SIP listener reachable on the intended interface;
- TLS certificate valid where enabled;
- database connection healthy;
- secret references resolvable;
- control-plane authentication succeeds;
- extension provisioning succeeds;
- extension registration succeeds;
- inbound route reconciliation succeeds;
- outbound route reconciliation succeeds;
- call detail records are persisted;
- audit events are persisted;
- logs contain no secret material;
- restart/reconciliation restores the expected configuration.

## PSTN acceptance gate

PSTN connectivity is a separate verification stage. It requires evidence of:

- carrier authentication/registration;
- a verified assigned number;
- successful inbound call;
- successful outbound call;
- correct caller-ID behaviour;
- correct tenant/extension routing;
- CDR creation;
- failure handling;
- carrier disconnect/reconnect behaviour.

Until those checks are completed against a real carrier and runtime, the platform must be described as **runtime-ready**, not live telephony.

## Security requirements

- Never expose SIP credentials through API responses unless explicitly required and authorized.
- Store only secret references in the control-plane configuration model where possible.
- Use tenant-scoped authorization for extension and route changes.
- Record administrative configuration changes in the audit trail.
- Apply rate limits and fraud controls to externally reachable signalling and call origination paths.
- Keep emergency calling policy explicit and jurisdiction-aware; do not imply emergency-service availability until separately verified.
- Back up control-plane data and document restoration of runtime configuration.

## Rollback

Every runtime deployment must be reversible. Configuration is generated from the control-plane desired state, and a failed deployment must be able to return to the previous known-good runtime configuration without destroying tenant records.

## Evidence required for production acceptance

The following evidence must exist before production status is declared:

1. Runtime health result.
2. SIP registration result.
3. Inbound call test record.
4. Outbound call test record.
5. CDR/recording verification where enabled.
6. Tenant-isolation/security verification.
7. Restart/reconciliation verification.
8. Backup/restore verification.
9. Carrier connectivity verification.
10. Operator acceptance sign-off.

Source code alone is never sufficient evidence of live telephony.