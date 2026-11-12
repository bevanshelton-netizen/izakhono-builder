# THOR Repository Inventory — 12 November 2026

## Purpose

Evidence-led inventory of the existing IZAKHONO Builder repository for THOR MVP-0. This document records what was inspected, what can be reused, and what remains unproven. It is not a production-readiness declaration.

## Verified implementation map

| THOR plane | Existing code | Verified capability | Gap / boundary |
|---|---|---|---|
| Native Builder | `autonomy/builder-adapter.mjs`, `autonomy/native-builder.mjs` (adapter imports this module), root `README.md` | Builder adapter routes to `runNativeBuilder`; root README documents native website artifact generation and deterministic fallback | Full arbitrary application/code generation and deployment are not established by this inspection |
| Planning | `autonomy/ai-agent-planner.mjs`, `autonomy/ai-agent.mjs` | Goal decomposition into ordered, dependency-aware stages; plan and queue persistence | Plan/queue are JSON files; no transactional multi-process claim semantics verified |
| Worker | `autonomy/ai-agent-worker.mjs` | Processes queued/running items, executes native Builder or NODE actions, writes state and evidence | Iterates queue sequentially; no worker lease, heartbeat, claim lock, cancellation, handoff, dead-letter queue, or demonstrated concurrent workers |
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
