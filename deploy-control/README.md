# IZAKHONO DEPLOY

IZAKHONO DEPLOY is the owned-first application delivery and runtime control plane. It extends the existing IZAKHONO BUILDER, NODE01-SW, IZAKHONO CONTROL, and PROVISIONER foundations; it is not a second hosting stack.

## Cost and independence principles

- No required paid AI builder, AI API, inference token, or usage-credit account.
- No runtime dependency on Vercel, Render, or another proprietary PaaS.
- Prefer open-source components and the existing owner-controlled execution capacity.
- The platform still consumes real compute, electricity, network bandwidth, storage, backups, and potentially domain/ISP services. "No credits or tokens" does not mean zero operating cost.
- CI may use GitHub-hosted runners only as an optional convenience; production execution remains portable and owner-controlled.

## Existing architecture to reuse

- IZAKHONO BUILDER: source/build workflow and product orchestration.
- NODE01-SW: portable software-runtime identity and workspace/job foundation.
- IZAKHONO CONTROL: owner operations and policy boundary.
- IZAKHONO EDGE: ingress, TLS, routing and rate controls.
- Existing registry/provisioner and shared database contracts where appropriate.

Do not create a second NODE01 identity, duplicate registry, second finance ledger, or parallel application database.

## Deployment lifecycle

`DISCOVERED → VALIDATED → BUILT → TESTED → APPROVED → RELEASED → HEALTHY → VERIFIED`

A failed stage blocks promotion. Rollback references the last known-good immutable image digest. A Git commit SHA is not a substitute for an image digest.

## Provider-neutral target model

A target adapter exposes capability and health information without leaking provider-specific details into the control plane:

- `inspectTarget()`
- `validateRelease(release)`
- `deployRelease(release, policy)`
- `getDeployment(deploymentId)`
- `getHealth(deploymentId)`
- `rollback(deploymentId, knownGoodRelease)`

Initial adapters: NODE01-SW runtime adapter first; optional external Docker-compatible target second. No adapter may claim success without runtime evidence.

## AI/operator integration

The management API is read-only by default. Mutations require a narrowly scoped service identity, an allowlisted operation, an idempotency key, policy evaluation, and an audit event. Production promotion, rollback, destructive operations, and secret rotation require explicit human approval. No arbitrary shell endpoint and no unrestricted host access.

## Current state

This repository addition defines the product boundary and build contract. It does not assert that a target is connected, that a deployment has run, or that public HTTPS is live. Runtime binding and owner-environment acceptance remain separate verification gates.
