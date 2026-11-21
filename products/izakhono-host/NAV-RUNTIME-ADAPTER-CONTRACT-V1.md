# HOST NAV Runtime Adapter Contract v1

## Purpose

Define the provider-neutral boundary between HOST's workload lifecycle and an approved execution environment. HOST remains the provisioning, policy, audit and lifecycle authority. A runtime adapter translates HOST operations into the selected execution provider's API.

A runtime target is an opaque, replaceable HOST binding. It is not a physical server, hostname, IP address, VM name or hardware ownership requirement.

## Required adapter operations

Every trusted server-side adapter must implement:

1. `resolveTarget({ runtimeTargetId, workload })` — resolve an allow-listed logical HOST target to provider context.
2. `provision({ target, workload, signal })` — create or reconcile the isolated workload execution resource.
3. `deploy({ target, resource, releaseDigest, workload, signal })` — deploy the immutable OCI release by SHA-256 digest.
4. `inspect({ target, resource, workload, signal })` — return observed runtime state, health and deployed release identity.
5. `stop({ target, resource, workload, signal })` — stop the workload without deleting persistent data.
6. `destroy({ target, resource, workload, signal })` — remove execution resources only; persistent data deletion requires a separate owner-approved workflow.
7. `backup({ target, resource, workload, signal })` — create a durable backup and return its immutable identifier and integrity evidence.
8. `restore({ target, resource, backupId, workload, signal })` — restore a selected backup and return verification evidence.

The contract module validates this method surface and provides an allow-listed adapter registry. It deliberately does not implement a cloud, container or hardware provider.

## Security requirements

- Adapter implementations are trusted server-side modules selected from HOST configuration, never from browser-supplied module names or code.
- Provider credentials remain in the server-side secret store and are never returned in API responses or audit metadata.
- No browser-supplied shell commands, Docker arguments, Compose documents, arbitrary image references or provider credentials.
- Deployments use immutable OCI digests; mutable tags are not accepted as release identity.
- Workload execution is isolated on private networks. NAV Engine, Valhalla, Nominatim and tile services are not directly exposed to public ingress.
- Operations must be idempotent where provider APIs permit, bounded by timeouts, cancellation-aware and auditable.
- Adapter errors must be normalized without leaking credentials, secret values or raw provider configuration.
- Destructive resource operations must preserve workload data and require separate explicit owner approval for data deletion.

## Required operation evidence

HOST must persist provider-neutral evidence for each operation: operation ID, workload record ID, adapter ID, opaque target binding, release digest where applicable, start/end timestamps, outcome, normalized error code and integrity-checked artifact identifiers.

A provider's asynchronous acceptance response is not proof of readiness. HOST must poll or observe the actual resource and then independently verify the NAV health endpoint and application-level acceptance gates.

## Lifecycle integration boundary

The current HOST API records workload requests as `queued-awaiting-runtime-adapter`. The adapter contract does not change that status and does not claim that NAV is running.

The next integration stage must add a durable worker that:
1. claims a queued workload with a lease;
2. resolves its approved adapter and opaque runtime target;
3. advances the existing state machine only after each operation succeeds;
4. persists operation evidence and retries safely;
5. verifies runtime, data import, routing, search, tiles and persistence before READY;
6. keeps backup/restore, HTTPS, DNS and public activation as separate acceptance gates.

No adapter may promote a workload directly to READY or public-live.

## Provider selection

The adapter contract is intentionally provider-neutral. The concrete provider must be selected only after technical, security, data-residency, availability, commercial and operational due diligence. HOST must be able to replace the adapter without changing NAV's logical NODE01 identity, release contract or workload data model.

## Current status

The contract module and unit tests establish the adapter boundary and registry behavior. No concrete provider adapter is registered, no runtime target is bound, and no production execution resource has been provisioned by this change.
