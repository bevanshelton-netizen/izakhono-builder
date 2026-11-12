# THOR — IZAKHONO Autonomous Build & Operations Engine

**Product identity:** THOR  
**Parent platform:** IZAKHONO BUILDER  
**User workbench:** IZAKHONO FORGE  
**Execution fabric:** NODE01 / IZAKHONO Agent Fabric  
**Operating principle:** OWNED-FIRST. NO HOSTAGE PLATFORM. ALL PROJECTS MOVE IN PARALLEL.

THOR is the execution and orchestration layer that makes the existing IZAKHONO Builder a continuously working software factory. It is not a second, competing builder. It consolidates the native Builder Core, Forge workbench, AI planner, agent worker, task queue, runtime fabric, and release controller into one coherent product.

## Mission

A user states an outcome once. THOR discovers the relevant project context, decomposes the outcome into dependency-aware tasks, assigns work to available specialist workers, executes independent tasks concurrently, integrates changes, runs tests, repairs failures, prepares releases, and reports evidence. It must continue across all active IZAKHONO projects without waiting for repeated NEXT/PROCEED prompts.

## Existing assets to reuse

- `apps/izakhono-forge`: visual Build Anything workbench and UI/API surface.
- `products/izakhono-native-builder`: project registry, build request lifecycle, risk classification and approval gates.
- `autonomy/ai-agent-planner.mjs`, `autonomy/ai-agent-worker.mjs`, `autonomy/ai-agent.mjs`: planning and worker foundations.
- `autonomy/agent-queue.json`, `autonomy/agent-state.json`: existing queue/state foundations.
- `infra/autonomous-control-plane` and `infra/runtime-fabric`: orchestration/runtime foundations.
- `node01` and `node01-sw`: logical software identity and runtime integration.
- Existing test, evidence, provisioning and owned-hosting components.

Do not rewrite functioning subsystems or create duplicate registries/queues. Audit, connect, harden and test the existing components.

## Product architecture

1. **THOR Command** — natural-language outcome intake, project selection and progress view.
2. **Portfolio Registry** — canonical projects, repositories, environments, owners, dependencies and release state.
3. **Intent Compiler** — converts a request into an explicit plan, acceptance criteria and risk classification.
4. **Agent Fabric** — specialist workers for frontend, backend, data, API, design, QA, security, DevOps, research, documentation and commercial operations.
5. **Scheduler** — dependency-aware concurrent execution, priorities, fairness, retry budgets, cancellation and back-pressure.
6. **Execution Workers** — isolated, resource-bounded workspaces; scoped repository access; patch/branch/PR output; no implicit production-secret access.
7. **Model Router** — pluggable local and external model adapters. Deterministic tasks must run without an LLM. No mandatory Hercules credits or proprietary AI-credit wallet.
8. **Integration Engine** — conflict detection, merge checks, shared contracts and cross-project dependency coordination.
9. **Verification Engine** — unit, integration, browser, accessibility, security, dependency, build and acceptance checks.
10. **Release Controller** — immutable release candidates, approvals, deployment, health checks, rollback and evidence.
11. **Operations Console** — live task status, worker heartbeat, logs, artifacts, failures, costs/capacity and audit trail.
12. **Commercial Workflows** — customer intake, provisioning, CRM, payments and handover through existing IZAKHONO services.

## Mandatory parallel operating rules

- All independent projects must have active work in the same execution cycle.
- All available builders may contribute across projects; no permanent project silos.
- Scheduler must reserve capacity for every eligible active project before allowing one project to monopolise workers.
- When a task is blocked, record the exact dependency, hand it off and immediately run another eligible task.
- Every task has one owner, one isolated workspace/branch and explicit acceptance evidence.
- Cross-review and cross-project reuse are mandatory.
- Show real statuses: DISCOVERED, READY, QUEUED, RUNNING, BLOCKED, VERIFYING, RELEASE_CANDIDATE, RELEASED, FAILED.
- A project is not marked active merely because it has a backlog or a dashboard card. RUNNING requires a live worker lease/heartbeat and task events.
- No fake progress, invented agents, or deployment claims without evidence.

## Safety and owner gates

Workers may inspect, plan, scaffold, edit, test, repair and package within approved scopes. Require explicit owner approval for production releases, destructive operations, financial commitments, external communications, domain/DNS cutovers, permission changes, and regulated-data access. Secrets remain server-side and are never exposed to model prompts, source code, client bundles or logs.

NODE01 remains a logical software identity, not a physical server. THOR must run on any eligible replaceable execution substrate and must not wait for physical NODE01 activation to perform work that can run in an available environment.

## Delivery sequence

### THOR-0 — Truth and wiring
Inventory existing modules, workflows, queues, workers, agents, repositories and active projects. Identify the canonical implementation for each capability. Remove contradictory Hercules-as-preferred wording. Produce a dependency map and measurable baseline.

### THOR-1 — One execution spine
Connect Forge → Native Builder API → Planner → Scheduler/Queue → Worker → isolated workspace → tests → evidence. Persist job state and events. Provide a real worker heartbeat and lease expiry/recovery.

### THOR-2 — Portfolio concurrency
Load every active platform into the canonical registry. Implement fair scheduling and cross-project concurrency, task handoff, retry, cancellation and blocker isolation. Demonstrate simultaneous work on at least three independent repositories/projects.

### THOR-3 — Visible command centre
Show project health, current worker assignments, task progress, build logs, changed files, test results, blockers and evidence. Never show a worker as active without a live lease.

### THOR-4 — Native release and customer handover
Connect verified release candidates to IZAKHONO-owned runtime, health checks, rollback, domains, TLS and provisioning. Keep external hosting adapters optional and reversible.

### THOR-5 — Independence certification
Demonstrate new-project creation and existing-project editing with Hercules unavailable, no Hercules credentials, and no Hercules credits. Run the full acceptance suite on owned execution capacity.

## Definition of done

- One plain-language request creates a persisted plan and auditable tasks.
- Multiple independent projects execute concurrently on real workers.
- Worker restarts do not lose jobs; leases expire safely and jobs resume or are explicitly failed.
- Code changes are isolated, reviewable and attributable.
- Tests run and evidence is attached before release promotion.
- Owner approval gates are enforced for sensitive actions.
- The Forge UI reflects live persisted state rather than simulated progress.
- New and existing apps can be built/edited without Hercules.
- A representative release is deployed and verified on IZAKHONO-owned runtime.
- A documented Hercules-offline test passes.

## First engineering deliverables

1. THOR system inventory and module ownership map.
2. End-to-end execution-spine integration test.
3. Real worker heartbeat/lease and persisted task event stream.
4. Fair portfolio scheduler with concurrent execution tests.
5. Forge live operations panel wired to persisted task/worker state.
6. Hercules-independent acceptance workflow.

**Current status:** THOR is an execution directive and product identity over existing IZAKHONO Builder assets. This document does not claim that the integrated THOR runtime is already deployed or that workers are currently executing.