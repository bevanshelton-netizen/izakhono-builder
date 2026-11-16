# THOR and the Shared IZAKHONO Provisioner

## Decision

THOR is the business/application creation and software-factory control plane. The shared IZAKHONO Provisioner is the infrastructure allocation and deployment execution plane. They are integrated by a versioned adapter contract; neither is a replacement for the other.

The integration does not create a second Provisioner and does not repurpose domain-specific provisioning products.

## Responsibilities

| Capability | System of record |
|---|---|
| Business brief, product specification and project plan | THOR |
| Task graph, worker assignment, coding runs and test evidence | THOR |
| Immutable artifact identity and release request | THOR |
| Infrastructure plans, resource allocation and provider operations | Shared IZAKHONO Provisioner |
| Runtime/node binding and deployment orchestration | HOST / owned runtime adapters |
| Network ingress, DNS and TLS | IZAKHONO EDGE adapters |
| Identity, approvals, secrets policy and audit | FORTRESS |
| Independent health, smoke and release verification | Verification service with evidence returned to THOR |
| Customer handover package | Shared Provisioner, linked to THOR release record |

## Required release sequence

`REQUEST → SPECIFY → BUILD → TEST → REVIEW → PACKAGE → APPROVE → PLAN → PROVISION → DEPLOY → VERIFY → HANDOVER → MONITOR`

1. THOR produces a signed or otherwise provenance-verifiable immutable artifact.
2. THOR creates a release envelope bound to the exact project, artifact digest, logical NODE identity and environment.
3. FORTRESS/approval service records an authorised approval covering those exact values.
4. The Provisioner adapter generates an idempotent resource plan. A blocked plan stops before provisioning.
5. The Provisioner allocates resources and deploys the immutable artifact using a stable idempotency key.
6. Independent verification checks runtime health and required application acceptance.
7. Only verified deployments receive a customer handover package.
8. THOR records the evidence references and release state. A deployment response alone never means LIVE.

## Adapter contract

The executable boundary is implemented in `src/provisioner-contract.mjs`.

- `validateReleaseEnvelope(input)` validates artifact digest, target identity, approval identity, timestamp and exact approval scope.
- `executeApprovedRelease(input, adapter)` invokes `authorize → plan → provision → verify → handover` in order.
- `authorize(context)` must resolve the approval against the authoritative FORTRESS/approval service and return an evidence reference. A caller-supplied `status: approved` field is not sufficient.
- Every adapter receives `thor-release:<releaseId>` as its idempotency key.
- Each stage must return an explicit success state and durable evidence/reference.
- Missing approval, scope mismatch, invalid artifact, failed authoritative authorization, unready plan, unconfirmed deployment, failed verification or missing handover fails closed.

The adapter must be implemented by a server-side service. Do not expose service credentials to THOR browser clients or coding workers. Provider credentials are injected only by the trusted Provisioner runtime.

## Identity and infrastructure rules

- `NODE01` is a logical software/runtime identity, never a physical machine or host.
- `runtimeHostRef` is a separate, replaceable execution-environment reference.
- Prefer IZAKHONO-owned runtime nodes and provider-neutral adapters.
- External fallback capacity is allowed only when explicitly approved and recorded.
- No Vercel or Supabase runtime dependency is introduced by this contract.
- Database, object storage, compute and network providers remain replaceable behind adapters.

## Domain boundary

I-CONNECT telecom provisioning retains its own product identity, customer data, network activation workflow, provider adapters and operational state machine. It may consume shared identity, audit, billing or infrastructure capabilities through explicit contracts, but it must not be merged into THOR's software release state machine.

Other domain-specific provisioning (email, payments, domains, connectivity and customer onboarding) follows the same rule: integrate by adapters and events, preserve domain ownership.

## Production acceptance

Do not promote a release until all evidence exists:

- immutable artifact digest and provenance;
- approved release record with exact scope;
- provisioner plan and idempotency key;
- deployment identifier and target binding;
- independent health and application acceptance evidence;
- rollback reference and tested recovery path;
- backup/restore evidence for stateful workloads;
- audit trail and handover package.

This integration contract is not itself proof that a production Provisioner, owned runtime node, EDGE, or FORTRESS deployment is live. Those require independent runtime evidence.
