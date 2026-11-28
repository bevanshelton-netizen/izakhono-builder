# THOR — IZAKHONO Native Autonomous Execution Engine

**Status:** Canonical execution brief, v1.0  
**Date:** 26 November 2026  
**Repository:** `bevanshelton-netizen/izakhono-builder`  
**Related directive:** GitHub issue #623 (THOR) and portfolio-wide execution order #622.

## 1. Mission

THOR is the Hercules-independent native execution engine for the existing IZAKHONO AI Autonomous Project Factory. It completes and integrates the modules already present in IZAKHONO Builder, Forge, Native Builder Core, planner/worker, registry and NODE01 Agent Fabric. It is not a new greenfield builder and must not duplicate or rename IZAKHONO AI, IZAKHONO AUTOPILOT or IZAKHONO AI WORKFORCE.

The user-facing promise is simple: describe the outcome in ordinary language, see what the factory is actually doing, and return to the same project later without losing context.

## 2. Product boundaries

- **IZAKHONO AI** is the conversational intelligence and model-routing product surface.
- **IZAKHONO AUTOPILOT** coordinates continuous objective execution and progress across projects.
- **IZAKHONO AI WORKFORCE** manages specialist agents, roles, capabilities, policies and task assignments.
- **IZAKHONO Builder / Forge** provides native application creation, editing, packaging and the operator workbench.
- **THOR** is the shared native execution engine beneath these distinct products.
- **NODE01 Agent Fabric / IZAKHONO NODE** provides the provider-neutral runtime and worker execution layer.

These names remain distinct. Shared infrastructure does not mean merging product identities or creating duplicate applications.

## 3. Governing architecture

```text
Conversational interface (mobile-first)
        |
        v
Project context + persistent memory
        |
        v
Intent compiler / planner
        |
        v
Portfolio scheduler + dependency graph
        |
        v
Durable queue + transactional state + leases
        |
        +----------+-----------+-----------+
        |          |           |           |
      Build      Research    Security    Operations
      workers    workers     workers     workers
        |          |           |           |
        +----------+-----------+-----------+
                   |
                   v
       Isolated project workspaces
                   |
                   v
       Tests → Fixes → Verification
                   |
                   v
          Artifact/package registry
                   |
                   v
       Approval-gated deployment
                   |
                   v
        Runtime evidence + continue
```

The control plane owns project state, task identity, policy decisions, queue coordination, evidence and audit history. Model and infrastructure providers are replaceable adapters.

## 4. Existing components to reuse

| Existing component | Intended responsibility |
|---|---|
| `apps/izakhono-forge` | Conversational command surface and visual workbench |
| `autonomy/ai-agent-planner.mjs` | Deterministic plan generation |
| `autonomy/ai-agent.mjs` | Plan creation and queue insertion |
| `autonomy/ai-agent-worker.mjs` | Real task-step execution |
| `autonomy/runner.mjs` | Continuous controller and adapter dispatch |
| `products/izakhono-native-builder` | Native artifact generation and queue primitives |
| `products/node01-agent-fabric` | Planner, scheduler, persistent queue, worker pool and distributed-runtime contracts |
| `registry/builder-queue.ts` | Shared queue/control-plane foundation |
| `registry/worker-supervisor.contract.test.ts` | Supervisor contract regression tests |

The exact production composition must be established by integration tests. The presence of modules is not proof that they are wired together or running.

## 5. Required execution behaviour

The factory must operate continuously:

`BUILD → EXECUTE → TEST → FIX → VERIFY → PACKAGE → DEPLOY → CONTINUE`

- Build independent projects in parallel, not one project at a time.
- Schedule dependency-ready tasks fairly across the whole portfolio.
- Isolate workspaces, files, credentials and state by project and tenant.
- When one project is blocked, record the precise reason and continue other eligible work.
- Persist every task transition, worker identity, attempt, output digest and evidence reference.
- Use bounded retries and exponential backoff for recoverable failures.
- Use leases, heartbeats and fencing tokens for multi-worker ownership.
- Quarantine interrupted non-idempotent work until an authorized recovery decision is recorded.
- Verify generated artifacts with actual tests; never fabricate completion.
- Keep deploy, DNS, public release, financial and other consequential actions behind explicit authorization gates.

## 6. Provider independence

The native builder, queue, state store, scheduler, workers and control plane are IZAKHONO-owned components. Hercules, GitHub Actions, Vercel, Supabase, model vendors and other services may be used only as replaceable adapters or temporary development capacity.

The native build path must demonstrably create a new application and edit an existing application while Hercules is disconnected and its credit balance is zero. Production operation must not depend on a browser session or a hosted CI schedule.

## 7. User experience contract

The primary interface must feel as familiar as a straightforward ChatGPT conversation:
- one clear message composer;
- natural-language requests and follow-up conversation;
- a simple project switcher;
- persistent project history and context;
- visible plan and current real task state;
- clear display of blockers, approvals and evidence;
- usable one-handed on a phone, with navigation designed mobile-first.

Advanced configuration belongs behind optional detail panels. Users should not have to understand agents, queues, adapters or infrastructure to request an outcome.

The Forge workbench remains an editing surface, not a replacement for the conversational interface.

## 8. Delivery sequence

### Phase A — truthful worker execution
Integrate the controller with the real worker, private persistent state, exclusive local lock, interruption quarantine and bounded retry policy. Keep ephemeral CI storage fail-closed.

### Phase B — durable shared control plane
Replace production JSON/filesystem coordination with an owned transactional store and durable queue. Implement idempotent claims, worker leases, heartbeats, fencing, retry scheduling, cancellation, dead-letter handling and audit events.

### Phase C — multi-project parallelism
Add fair scheduling across projects, isolated workspaces and resource limits. Prove at least three independent projects execute concurrently; prove a blocked project does not stall the others.

### Phase D — conversational Forge integration
Connect the existing Forge UI to real persistent projects, job state, event history, artifact links and worker evidence. Remove browser-only history as the source of truth. Ensure mobile-first navigation and responsive behaviour.

### Phase E — independent runtime and release
Run workers on an authorized owned execution substrate, independent of Hercules and browser sessions. Verify build, tests, package integrity, deployment, health, public route and rollback before marking a release LIVE.

## 9. Acceptance tests

1. A new project can be created and an existing project edited with Hercules unavailable and zero Hercules credits.
2. Project and conversation context survives refresh, device change, worker restart and application redeployment.
3. Three independent project queues are claimed and executed concurrently without state or artifact crossover.
4. A blocked or failed project does not prevent other eligible projects from progressing.
5. Duplicate delivery is idempotent; expired leases are safely recovered; stale workers cannot commit after losing a lease.
6. Retry delays are bounded and persisted; approval-waiting work does not spin.
7. Interrupted external side effects are quarantined and require explicit recovery.
8. Every completed build has artifact hashes, test results and an execution receipt.
9. Deployment cannot bypass owner approval, environment policy or immutable release evidence.
10. A production-live claim is supported by independent runtime and public endpoint checks.

## 10. Current known gaps (must remain visible)

- The local filesystem lock is single-host only.
- JSON state and queue files are not transactional multi-host storage.
- A real worker is being integrated into the controller; draft PR validation is not production activation.
- The current Forge UI's recent-build history is held in browser component state; persistent project history and live event hydration are not yet proven.
- The Forge command API can persist jobs through Supabase when configured, but it currently falls back to an in-memory/local response when credentials are absent.
- Three-project concurrent execution has not yet been demonstrated.
- An authorized owned runtime, credentials and durable storage are still required for production workers.
- The referenced `docs/THOR-EXECUTION-ENGINE.md` was absent from the main-branch tree at the time this brief was created; this file supplies that missing canonical brief.

## 11. Non-negotiable safety and cost rules

No spending, subscription changes, paid resource creation, irreversible production mutation, public deployment, DNS cutover, secret rotation or external financial action without explicit owner authorization. Continue repository-side implementation, deterministic tests, documentation and reversible preview work autonomously.

Do not call a workflow heartbeat a worker, a successful CI check a production deployment, a queued job a completed build, or a preview deployment a public release.
