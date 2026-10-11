# IZAKHONO RUNTIME — Sovereign Hosting Engine v1

The runtime is the execution layer behind IZAKHONO HOST. It is designed to replace Vercel as the **primary** deployment platform while keeping external providers as reversible adapters only.

## Mission

Turn a validated application artifact into a running, observable, rollback-capable HTTPS service on IZAKHONO-owned compute.

## Core contract

`source/artifact → build → immutable image → deployment revision → health gate → traffic → telemetry → rollback`

## Required capabilities

- Git/repository artifact intake
- deterministic builds
- OCI/Docker image creation
- immutable content-addressed revisions
- environment and secret references without committing secrets
- deployment slots: preview, staging, production
- HTTP/TCP health gates
- atomic traffic switching
- automatic rollback on failed health gates
- deployment logs and structured events
- CPU/RAM/storage/network quotas
- per-tenant isolation
- custom-domain routing
- TLS certificate lifecycle hooks
- object/artifact storage hooks
- background job execution
- audit trail
- node registration and heartbeats
- capacity-aware scheduling
- node drain and failover

## Sovereignty rule

NODE01 is compute capacity, not the source of truth. IZAKHONO HOST owns customer state, deployment state, revisions, routing intent and audit evidence. Additional nodes can be added without changing the control plane.

## Node topology

`IZAKHONO HOST → Scheduler → NODE01..NODE04 → FORTRESS → EDGE/TLS → IZAKHONO DNS`

A node can be drained without changing the application contract. A deployment is not called live until the runtime health gate and external HTTPS acceptance evidence pass.

## Vercel migration rule

Vercel is a **transition adapter only**. New production deployments must target `izakhono-runtime`. Existing Vercel deployments remain available solely for rollback/continuity until an IZAKHONO deployment has passed acceptance.
