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

The contract module validates this method surface and provides an allow-listed adapter registry. The worker consumes only a trusted server-side registry and HOST binding resolver. Neither module implements or assumes a cloud, container or hardware provider.

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

The HOST process can start the bounded runtime and data worker loops when an owner-approved adapter URL, server-side token and logical target binding are configured. The runtime worker deploys the immutable release, independently inspects the deployed digest, records runtime-deployed-awaiting-data-pipeline and automatically creates the durable data-import job. The data worker then executes the resumable South Africa data pipeline and transitions the workload through STARTING and VERIFYING to internal READY only after routing, search, tiles, engine, web and persistent-data evidence pass. Backup/restore, HTTPS, DNS and public activation remain separate acceptance gates.

No adapter may promote a workload directly to READY or public-live.

## Provider selection

The adapter contract is intentionally provider-neutral. The concrete provider must be selected only after technical, security, data-residency, availability, commercial and operational due diligence. HOST must be able to replace the adapter without changing NAV's logical NODE01 identity, release contract or workload data model.

## Executable HTTP adapter and worker activation

The trusted generic HTTP adapter is implemented in the HOST provisioner:

- GET /v1/runtime-targets/{runtimeTargetId} returns the exact runtimeTargetId, approved=true, enabled=true and an opaque providerTargetRef.
- POST /v1/runtime-targets/{runtimeTargetId}/workloads returns a stable resourceId.
- POST /v1/runtime-targets/{runtimeTargetId}/workloads/{resourceId}/release deploys the requested releaseDigest; GET /v1/runtime-targets/{runtimeTargetId}/workloads/{resourceId} returns healthy=true and the exact releaseDigest only after independent runtime inspection.
- Backup returns backupId, SHA-256 and a positive byte count. Restore accepts only a provider-issued backupId. Destroy preserves persistent data.
- POST /v1/nav-data/{stage} must be idempotent by the supplied idempotencyKey and may return {status:"running",operationId} or {status:"succeeded",evidence}. GET /v1/nav-data/operations/{operationId} returns the same status contract. A failed operation returns {status:"failed"}; raw provider details are not exposed to HOST callers.
- HOST validates all returned evidence; provider acceptance alone never marks a stage successful.

- runtime operations use fixed routes under /v1/runtime-targets and require an explicitly approved target response;
- data operations use fixed routes under /v1/nav-data for the five pipeline stages plus GET /v1/nav-data/operations/{operationId} for durable completion polling;
- provider calls require HTTPS except loopback development, bearer authentication, bounded timeouts, normalized errors and no-store responses;
- provider URLs, credentials and target bindings are server-side environment configuration only.

The HOST control-plane process starts its bounded runtime and data worker loops only when their complete configuration is present:
- HOST_NAV_RUNTIME_ADAPTER_URL
- HOST_NAV_RUNTIME_ADAPTER_TOKEN
- HOST_NAV_RUNTIME_TARGET_ID
- optional HOST_NAV_RUNTIME_ADAPTER_ID
- HOST_NAV_DATA_ADAPTER_URL and HOST_NAV_DATA_ADAPTER_TOKEN (these may use the runtime adapter URL/token when the same trusted service implements both contracts).

The workers run inside the same HOST process as the JSON stores. This preserves the stores' documented single-process/single-writer requirement. Do not scale the file-backed control plane to multiple replicas. A future multi-replica deployment must move workload and data-job state to a transactional shared database before scaling.

The runtime worker verifies the deployed immutable digest and records runtime-deployed-awaiting-data-pipeline. The data worker then runs the Geofabrik source, Valhalla, Nominatim, PMTiles and service-acceptance stages. Each stage uses an idempotent POST start operation that may return a durable operation ID; the worker stores that ID, releases its lease while the provider performs long-running imports, and polls the operation on a later pass. Waiting/polling does not consume failure retries. Provider operations must be idempotent by workload, immutable release digest and stage. A workload becomes internally READY only after all five services and persistent-data health are verified. Public-live remains separately gated by backup/restore, HTTPS and DNS evidence.

## Current status

The contract module, allow-listed registry, durable lease/evidence primitives, bounded workers and generic authenticated HTTP adapters are implemented with tests. The worker loops remain disabled unless an owner-approved adapter URL, server-side token and logical target binding are configured. No concrete provider target is approved or bound for a real release, and no production execution resource has been provisioned by this change.
