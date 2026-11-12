# THOR Existing Component Assessment

**Assessment date:** 12 November 2026  
**Repository:** `bevanshelton-netizen/izakhono-builder`  
**Purpose:** Prevent duplicate implementation by recording the components visible in the current repository snapshot. This is a code-level preliminary assessment, not production certification.

## Findings

### 1. Native Builder Core
Path: `products/izakhono-native-builder/src/index.ts`

Observed:
- Project registry types and statuses.
- Build request and job lifecycle.
- Risk classes and approval gating.
- Explicit state transitions.
- Store and clock interfaces.
- In-memory store for tests/local development.

Gaps to verify or implement:
- Durable production store integration and transaction semantics.
- Tenant/user authorization and project-level access control.
- Task decomposition and dependency graph.
- Worker assignment, leases, heartbeats, retries, cancellation and handoff.
- Artifact, commit, test and deployment evidence model.
- Concurrency/race tests for simultaneous state changes.

### 2. Native Builder Queue
Path: `products/izakhono-native-builder/src/queue.ts`

Observed:
- Database-backed queue abstraction.
- Conditional queued-to-running claim.
- Processor callback and result checks.
- Execution evidence persistence.

Gaps to verify or implement:
- Claim lease and recovery after worker crash.
- Atomicity across job status and evidence writes.
- Attempt count, retry policy and dead-letter queue.
- Worker heartbeat and stale-claim recovery.
- Priority/fairness and project-level concurrency.
- Multi-worker contention and idempotency tests.
- Persisted task-level dependency semantics.

### 3. Native Model Runtime
Path: `products/izakhono-ai-runtime/`

README describes:
- Local Ollama-compatible inference endpoint.
- CPU-first Qwen coder model baseline.
- Loopback-only default exposure.
- Persistent model weights.
- Explicit distinction between local model generation and deterministic fallback.

Gaps to verify:
- Runtime has actually been provisioned on a host.
- Model is downloaded and inference succeeds.
- Builder is configured to call it and records model identity.
- Authentication/private networking when workers run on separate nodes.
- Resource monitoring, concurrent request limits and model routing.
- Quality evaluation against real app-building tasks.

The documented endpoint and model are design/configuration claims until runtime evidence is collected.

### 4. Replica Engine
Path: `replica-engine/`

Observed:
- Eleven-stage clean-room product workflow.
- Structured brief-to-builder handoff.
- Explicit prohibition on copying protected source, branding and assets.
- Evidence-gated release intent.

Gap:
- The README says the actual source-generation engine remains Builder `/api/build-anything`; verify this endpoint's current implementation and route the handoff into the native THOR orchestration path.

## THOR integration direction

THOR should become the unifying product and control plane over these existing capabilities:

| THOR responsibility | Existing starting point | Required next action |
|---|---|---|
| Project/job domain | Native Builder Core | Extend with tenant, task, run, artifact and approval contracts |
| Durable queue | Native Builder Queue | Add leases, retries, recovery, fairness and concurrency tests |
| Local model inference | Native AI Runtime | Verify real host inference; add provider-neutral model gateway |
| Brief-to-spec workflow | Replica Engine | Connect to durable task graph and native builder |
| Multi-worker execution | Autonomy/registry areas | Inventory actual worker runtime; unify under one scheduler |
| Website/app generation | Website Factory / build-anything | Verify source-generation path and connect to THOR jobs |
| Owned deployment | NODE01 / Provisioner | Verify host/runtime gates; use approval-gated release adapter |
| Portfolio visibility | Existing command/control surfaces | Build THOR Command from actual job and worker telemetry |

## First engineering decision

**Do not rewrite the Native Builder Core or local model runtime from scratch.** Treat them as candidate components and harden the missing orchestration, worker isolation, evidence, multi-tenant and integration layers around them.

## Acceptance evidence still required

- Passing native-builder tests and type checks.
- Database migration and concurrency tests for queue claims.
- Demonstrated worker crash/restart recovery.
- Successful real local-model inference with recorded model identity.
- A repository change produced by a sandboxed worker and submitted as a pull request.
- Three independent jobs progressing concurrently across separate projects.
- Deployment preview and health evidence before any production-release claim.
