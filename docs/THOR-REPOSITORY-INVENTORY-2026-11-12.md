# THOR Repository Inventory — 12 November 2026

## Purpose

Evidence-led inventory of the existing IZAKHONO Builder repository for THOR MVP-0. This document records what was inspected, what can be reused, and what remains unproven. It is not a production-readiness declaration.

## Verified implementation map

| THOR plane | Existing code | Verified capability | Gap / boundary |
|---|---|---|---|
| Native Builder | `products/izakhono-native-builder/src/index.ts`, `products/izakhono-native-builder/src/queue.ts`, `autonomy/builder-adapter.mjs`, `autonomy/native-builder.mjs` | Native Builder Core defines project/job types, risk-based approval gates and explicit job transitions; DB-backed queue uses conditional queued-to-running claims and persists execution evidence; autonomy adapter routes to `runNativeBuilder` | Existing queue has no lease/heartbeat, retry/recovery, task dependency graph or concurrency proof; Native Builder Core persistence/authentication/worker isolation remain host-injected |
| Planning | `autonomy/ai-agent-planner.mjs`, `autonomy/ai-agent.mjs` | Goal decomposition into ordered, dependency-aware stages; plan and queue persistence | Plan/queue are JSON files; no transactional multi-process claim semantics verified |
| Legacy autonomy worker | `autonomy/ai-agent-worker.mjs` | Processes JSON-file queue items and executes native Builder or NODE actions | Single-process sequential loop; no durable lease/heartbeat or demonstrated concurrent workers. THOR's separate `products/thor-control-plane/` is the newer orchestration implementation |
| Worker tests | `autonomy/ai-agent-worker.test.mjs`, `autonomy/ai-agent-planner.test.mjs` | Tests native plan progression and generated portable artifacts; planner dependency tests | Tests do not prove multi-process safety, worker loss recovery, retries, or three-worker concurrency |
| Software NODE | `node01/server.js`, `node01/package.json`, `node01/README.md` | Portable HTTP service, health/node endpoints, workspace registry, in-memory job acceptance | Job map is process-memory only; generic jobs explicitly do not execute arbitrary code; no auth or durable queue in v0.1 |
| Software NODE lifecycle | `autonomy/software-node.mjs`, `autonomy/node-adapter.mjs` | Local software-node identity, heartbeat and basic eligibility checks; workload scheduler adapter | Local evidence is not proof of a persistent, remotely reachable, production worker fleet |
| Local model runtime | `products/izakhono-ai-runtime/README.md` | Ollama-compatible local inference contract; Qwen 2.5 Coder 3B CPU-first baseline; no public inference port | Runtime/model weights and actual inference were not exercised in this repository inspection |
| Replica workflow | `replica-engine/README.md` | Clean-room brief-to-planning package; hands source generation to native Builder | Planning workflow is not the THOR durable orchestration engine |
| Website factory | `website-factory/README.md` | Operator-facing factory surface and job-intake contract | README explicitly defers backend orchestration, payments, domain/email provisioning and node scheduling |
| Provisioner | `provisioner/README.md` | Server-side provisioning API delegates durable steps to Supabase RPCs; idempotency contract documented | This is a provisioning workflow, not a general THOR worker scheduler; live runtime was not tested |
| Autonomy policy | `autonomy/engine-manifest.json` | Continuous mode, auto-advance, retry policy, native Builder provider, owner gates and owned-first principles | Manifest policy is declarative; it does not prove a running scheduler or active workers |

## Key source observations

### Existing worker lifecycle

`autonomy/ai-agent-worker.mjs` reads JSON state and queue files, iterates eligible queue entries in one process, marks an item running, executes dependency-ready steps, and writes both files at the end. A failed step blocks its plan; a waiting step leaves it waiting. This is useful reusable single-process orchestration logic, but it is not yet a durable distributed queue.

### NODE01 boundary

`node01/server.js` keeps jobs in a JavaScript `Map`. It accepts jobs asynchronously, but its own source explicitly says arbitrary shell execution is deliberately absent and generic jobs return an adapter handoff message. It is a portable node/control-plane seed, not yet a sandboxed repository coding worker.

### Tests and evidence

The root `package.json` exposes `ai-agent:test`, which runs the planner and worker tests. The test source verifies a native artifact path and dependency progression. No test output was executed as part of this inventory; passing status is therefore not asserted.

## Architecture decisions for the next increment

1. **Reuse, do not replace:** retain the existing planner, native Builder adapter, node adapter and artifact generation path.
2. **Separate control plane from execution:** introduce explicit Project, Task, Dependency, Worker, Lease, Run, Artifact, Approval, Environment and Release contracts around the existing plan/step model.
3. **Durable claims before concurrency:** replace file read-modify-write queue claims with an atomic persistent claim operation, lease expiry, heartbeat renewal and idempotency key. JSON files may remain export/debug artifacts, not the concurrency authority.
4. **Isolated coding worker:** add a least-privilege repository adapter that uses a scoped GitHub installation/token, creates a bounded branch, runs allowlisted tests, and opens a PR. No unrestricted shell or production deployment.
5. **Prove failure handling:** test duplicate claims, worker crash/lease expiry, bounded retry, cancellation, handoff, dead-letter handling and unrelated-task progress.
6. **Prove parallelism:** demonstrate three different worker roles on three independent project tasks with timestamps, worker identities, logs, test results and PR references.
7. **Owner gates remain:** credentials, paid resources, destructive operations, security exceptions and production releases require the existing approval policy.

## Ordered MVP-0 → MVP-3 work

- **MVP-0:** this inventory; next add explicit architecture decision records and a dependency graph.
- **MVP-1:** durable task/worker contracts, atomic claims, lease/heartbeat, audit events and contract tests.
- **MVP-2:** one isolated GitHub coding worker producing a reviewable PR with test evidence.
- **MVP-3:** scheduler and three concurrent specialist workers across separate projects.

## Verification limits

This inventory was prepared by reading the repository files listed above through the connected GitHub integration. It did not execute repository tests, inspect a live NODE01 host, provision infrastructure, exercise model inference, or prove concurrent worker execution. No production or deployment claim is made.


## Additional THOR branch inspection and CI evidence

The THOR implementation is being developed on branch `thor-foundation`, which is why the Native Builder Core paths below were not present in the earlier default-branch fetch. They were subsequently fetched and inspected directly from the PR branch.

- `products/izakhono-native-builder/src/index.ts`: project/job domain types, explicit state transitions, risk classes and approval separation. Persistence, authentication and worker isolation are injected boundaries.
- `products/izakhono-native-builder/src/queue.ts`: D1-style database queue abstraction with conditional claim and execution-evidence writes. It has no lease recovery or retry lifecycle; the THOR control plane is the appropriate place to add those capabilities rather than duplicating this queue.
- `products/thor-control-plane/src/index.mjs`: provider-neutral scheduler with dependency checks, lease ownership, heartbeat, retry, cancellation and portfolio snapshot.
- `products/thor-control-plane/src/d1-store.mjs`: conditional D1 claim/update adapter, lease expiry recovery and event persistence. It has not yet been tested against a provisioned live D1 database.
- `products/thor-control-plane/src/worker-contract.mjs` and `WORKER-SECURITY.md`: bounded repository/branch/path/command/resource policy. The code explicitly states that this is not an OS sandbox.

### CI on inventory commit

Commit: `3469e1a5c7004c8f439e23165829bdf7a7365ab6`

- THOR orchestration tests: **passed**.
- OpenAI Independence CI: **passed**.
- Application Manifest Validation: **passed**.
- NODE01 Architecture Invariant: **passed**.
- Repository-wide IZAKHONO Builder CI: **in progress** at the time checked.
- Vercel deployment status checks reported resource-limit failures across projects. Those checks are external deployment attempts and do not invalidate the passing THOR unit-test workflow; they are not a reason to introduce Vercel as a THOR hosting dependency.

The PR remains unmerged. A green THOR test workflow proves the tested orchestration code path, not live D1 operation, a production sandbox, actual coding workers, three-project concurrency, or production deployment.
