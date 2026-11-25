# IZAKHONO DEPLOY — Managed Execution Environment Provisioning Contract v1

## Status

Architecture and implementation contract. It authorizes no provider connection, resource creation, payment, DNS change, database migration, runner registration, workload execution, or production promotion.

## 1. Core architectural decision

**NODE01 is software. NODE01 is not a physical server, virtual machine, container host, cloud instance, or provider account.**

NODE01 is a logical IZAKHONO Software NODE identity managed by Runtime Fabric. Its identity, policy, workload contract, health state, and promotion state must remain stable when its underlying execution capacity is replaced.

An execution environment is a separately identified, replaceable resource on which some part of the NODE01 software runtime executes. It may be supplied by IZAKHONO-owned compute, a VM, a container platform, a serverless/container execution service, or another approved substrate. The substrate is an implementation detail behind a provider-neutral adapter.

The platform must not require the user to own or manually supply a physical machine before creating a logical Software NODE. Equally, creating a logical NODE record does not prove that executable capacity exists.

## 2. Responsibility boundaries

| Component | Responsibility |
| --- | --- |
| Runtime Fabric | Logical NODE identity, scheduling, desired state, health, eligibility, failover and promotion |
| DEPLOY | Authorized workload release, lifecycle transitions, idempotency and deployment evidence |
| FORTRESS | Identity, scoped authorization, approval, secret references and immutable audit |
| Provisioning control | Request, plan, approve and reconcile execution-environment capacity |
| Provider adapter | Translate the provider-neutral contract into provider-specific resource operations |
| Execution environment | Run the authorized NODE agent/runtime and report attested capability and health |

Provisioning capacity and deploying an application are separate operations. A successful infrastructure provisioning result must never be represented as a successful workload deployment.

## 3. Provider-neutral adapter contract

Each adapter must expose the same logical operations:

- `capabilities()`: report supported resource classes, regions, runtime features, storage/network options, quotas and estimated costs without creating resources.
- `plan(request)`: return a deterministic, expiring plan with resource shape, provider identity, location, limits, estimated recurring/usage cost and required permissions. Planning is read-only.
- `provision(approved_plan)`: create only the exact resources in an unexpired, explicitly approved plan. Require an idempotency key and return provider resource identifiers.
- `inspect(resource_id)`: retrieve current resource state and capability evidence without mutation.
- `attest(resource_id)`: return signed or otherwise independently verifiable runtime-agent evidence bound to the exact provider resource.
- `drain(resource_id)`: stop new scheduling and allow controlled workload evacuation.
- `release(resource_id, approved_request)`: destroy/release only the exact resource explicitly approved for retirement, after backup and workload evacuation checks.

Adapters must not choose a provider, region, machine size, paid add-on, or resource quantity implicitly. They must not accept arbitrary shell commands or browser-supplied provider credentials.

## 4. Provisioning lifecycle

The control plane should represent capacity through explicit states:

`REQUESTED → PLANNED → AWAITING_APPROVAL → PROVISIONING → PROVISIONED → ATTESTING → ELIGIBLE`

Failure and retirement paths:

- `PROVISIONING → FAILED`: record provider request identifiers and safe diagnostic evidence; do not silently retry non-idempotent creates.
- `ATTESTING → QUARANTINED`: capacity exists but cannot receive workloads until identity, security and runtime checks pass.
- `ELIGIBLE → DRAINING → RELEASE_PENDING → RELEASED`: require workload evacuation, recoverable state and an authorized release decision.

Only `ELIGIBLE` capacity may receive workloads. Runtime Fabric retains the logical NODE identity independently of any one provider resource.

## 5. Attestation and NODE binding

The current coordinator deliberately keeps a provisioned resource in `PROVISIONED_PENDING_ATTESTATION`. It can return `ELIGIBLE` only after an independent evidence-verifier callback accepts the provider's attestation and all required claims pass validation.

The attestation must bind:

- exact provider resource ID, provider ID, provider-account reference and region;
- environment scope;
- logical NODE ID `NODE01` and logical type `software-runtime`;
- a non-empty runtime-agent identity and unique evidence ID;
- attestation observation time and expiry;
- all capabilities required by the approved plan;
- checks for agent identity, NODE/runtime binding, security baseline and live heartbeat.

Evidence must be fresh (no more than five minutes old), not future-dated beyond clock-skew tolerance, and unexpired. Missing, stale, mismatched or unverifiable evidence quarantines the resource. A provider's `attested: true` boolean by itself is never sufficient.

The verifier callback is an explicit trust boundary. The current tests use a deterministic fake verifier only; they do not constitute production cryptographic verification or a live FORTRESS integration. Eligibility is an execution-capacity state, not production authorization and not application deployment success.

## 6. Identity and binding

The binding record must distinguish at least:

- logical NODE ID (for example, `NODE01`);
- logical NODE type (`software-runtime`);
- execution-environment ID;
- provider and provider account reference;
- provider resource ID and region/location;
- runtime-agent identity and attestation reference;
- supported capabilities and resource limits;
- environment scope (development, test, staging or production);
- observed-at time, expiry/heartbeat and binding status.

The binding must explicitly assert `runtime_host_is_separate: true`. Provider resource IDs are not NODE IDs. A hostname, VM name, container name or provider label must never be used as the canonical logical NODE identity.

## 7. Authorization, cost and safety invariants

1. Capability discovery and planning are read-only.
2. No infrastructure resource may be created, resized, retained as paid capacity, or released without an explicit approval bound to the exact plan/resource, environment, cost ceiling and expiry.
3. No hosting or infrastructure cost may be incurred without the user's explicit approval.
4. Provider credentials remain in FORTRESS or an approved provider secret manager; they never enter Git, browser code, logs, deployment metadata or audit payloads.
5. Every mutating provider operation requires a FORTRESS-authorized service identity, least-privilege scope, idempotency key and actor-attributed audit event.
6. Provider retries must be idempotent or reconciled by inspecting the original provider operation before retry.
7. Capacity is not trusted merely because a provider reports it as running. Runtime-agent attestation, heartbeat, security and capability checks are mandatory.
8. No provider adapter may alter public DNS, route production traffic, or promote a NODE as a side effect of provisioning.
9. Backup/restore readiness and data placement must be evaluated before production eligibility.
10. Provider failure must not destroy logical NODE identity or customer state.

## 8. Initial implementation sequence

1. Keep the logical NODE registry and execution-environment registry separate.
2. Define and test the adapter interface and deterministic plan schema without provider credentials.
3. Add a read-only provider capability/plan path and cost disclosure.
4. Add approval and FORTRESS audit binding before any create/release operation is enabled.
5. Implement one provider adapter only after the owner selects the provider and explicitly approves its account, region, resource class and spending ceiling.
6. Verify agent attestation and NODE-to-environment binding in a non-production environment.
7. Connect DEPLOY to Runtime Fabric scheduling only after the database owner, authoritative database binding, transaction boundary and migration authority are confirmed.
8. Promote workloads only after independent runtime, storage, network, backup, security and application acceptance evidence.

## 9. Current verified boundary

At the time of this implementation update:

- The repository contains the logical Software NODE architecture and the owned HOST multi-node design.
- The connected SentinelX host registry returned zero enrolled hosts.
- The connected SentinelX integrations list returned zero configured integrations.
- No provider account, authoritative Runtime Fabric database binding, or authorized migration runner has been established by those checks.
- The new attestation path and tests exist in the review branch; the verifier in tests is simulated, not a production trust integration.

These observations do not alter NODE01's established logical Software NODE identity or require manual server enrollment. They mean no connected execution substrate or provider adapter is currently available through those inspected integrations.

## 10. Explicit non-goals

This contract does not select or purchase infrastructure, create cloud resources, enroll a physical host, configure a provider integration, execute a deployment, run a database preflight against production, apply migrations, change DNS, or authorize production traffic.

**Acceptance principle:** IZAKHONO owns the logical NODE contract, control plane, provisioning policy, workload definitions, security, evidence and recovery. Providers supply replaceable execution capacity under explicit authorization; they do not define NODE identity.
