# IZAKHONO Builder Contract v1.1

## Objective

Make every authorized IZAKHONO project a continuous, provider-agnostic build-to-completion workstream rather than a sequence of manual NEXT prompts.

## Execution loop

`DISCOVER → OBJECTIVE → PLAN → QUEUE → BUILD → EXECUTE → TEST → FIX → VERIFY → PACKAGE → DEPLOY → CONTINUE`

The control plane advances automatically when dependencies, policy and evidence permit. A blocked project must not prevent independent work in another project.

## Provider and execution independence

- IZAKHONO Native Builder and the existing local planner/worker path are the default build path.
- Provider adapters are replaceable capabilities. Hercules may be used as an optional adapter when explicitly available, but is never the preferred foundation or a required dependency.
- Model inference is optional and routed through the provider-neutral IZAKHONO model-router contract.
- Project state, queue ownership, execution receipts and release evidence belong to IZAKHONO-controlled services and storage.
- No commercial product may require Hercules, OpenAI, Vercel or another external provider to remain operational.

A provider adapter must not silently change the source of truth, bypass policy or claim work it did not execute.

## Builder adapter contract

A builder adapter receives:
- task and project identifiers;
- immutable task input and acceptance criteria;
- lifecycle stage and permitted action;
- required capabilities and evidence;
- correlation and idempotency identifiers.

It returns one of:
- `completed` — execution occurred and required evidence is available;
- `waiting` — a genuine external capability, credential or approval is required;
- `failed` — an attempted operation failed and must enter repair/retry policy.

A queued, busy, interrupted, idle or unverified result must never be converted into fabricated success.

## Queue, workers and concurrency

- Every task has a durable identity, project scope, dependencies, idempotency key, attempt history and evidence references.
- Independent projects and independent dependency-ready tasks run concurrently within declared resource and policy limits.
- A blocked task is recorded and skipped while other eligible work continues.
- Worker ownership is established through an expiring lease/heartbeat and fencing token in the production multi-worker implementation.
- State transitions and queue claims must be atomic in the production store. A single-host filesystem lock is a local safeguard, not distributed coordination.
- Interrupted non-idempotent work is quarantined for explicit recovery; it is not replayed based on guesswork.
- Retryable failures use bounded backoff. Waiting on an unavailable capability must not cause a hot retry loop.

## User experience

The primary interface is a familiar plain-language conversation: describe the outcome, clarify only what is necessary, see the plan and actual execution state, and continue discussing the same project without losing context.

The interface is mobile-first and exposes:
- a simple conversational command surface;
- project switcher and persistent project history;
- live task status, blockers and next safe actions;
- artifacts, test evidence and deployment status;
- clear human-approval requests for consequential actions.

The interface must reflect backend state. Simulated agents, fabricated progress, browser-only history and decorative LIVE indicators are prohibited.

## Safety and authorization

- Destructive operations, public releases, DNS cutovers, financial transactions, credential use and production data changes require their defined policy and owner authorization.
- Approval is bound to the exact project, action, target, environment and immutable release reference.
- Missing or unverifiable evidence fails closed.
- Secrets are referenced through the IZAKHONO secret-management boundary and never committed to source control or exposed to browser code.
- No paid resource, subscription change or irreversible action is initiated without explicit approval.

## Evidence and completion

A task is complete only when the real executor reports completion and the declared acceptance checks pass. A project is deployable only after build, tests, security checks, package integrity and target-environment checks pass. A project is LIVE only after independent runtime and public-route evidence confirms it.

Repository CI, a preview URL, a successful queue insert or a worker heartbeat alone is not proof of production execution.

## Current implementation boundary (26 November 2026)

Existing reusable foundations include:
- `apps/izakhono-forge` — plain-language command surface and workbench UI;
- `autonomy/ai-agent-planner.mjs`, `ai-agent.mjs`, and `ai-agent-worker.mjs` — planner, plan creation, queue insertion and worker execution;
- `autonomy/runner.mjs` — deterministic manifest controller and adapter dispatch;
- `products/izakhono-native-builder` — native build primitives and queue;
- `products/node01-agent-fabric` — provider-neutral planner, scheduler, worker-pool, persistent-queue and distributed-runtime contracts;
- `registry/builder-queue.ts` and `registry/worker-supervisor.contract.test.ts` — queue and supervisor foundations.

These are code foundations, not proof that the whole production system is integrated. Current JSON/filesystem worker state is single-host only. A durable transactional store, distributed leases, supervised owned workers, persistent project context, Forge live-state integration and three-project parallel acceptance remain required.

## Acceptance gates

1. Forge uses a familiar conversational, mobile-first interface and loads project state/history from the persistent control plane.
2. The native build path works with Hercules disconnected and zero Hercules credits.
3. A durable queue and transactional state store survive worker and process restarts.
4. Worker leases, heartbeats, fencing, retries, cancellation and interrupted-work recovery are tested.
5. At least three independent repositories/projects execute concurrently with isolated workspaces and no cross-project state leakage.
6. A failure or owner gate in one project does not stop other eligible projects.
7. Build → test → fix → verify → package produces inspectable artifacts and evidence.
8. Deployment remains separately authorized and is verified against an actual target runtime.
9. The same user-facing project history survives browser refresh, device changes and worker restarts.
10. All claims of completion, active workers and production status are backed by timestamped evidence.

## Operating rule

Continue all technically safe repository-side work while external dependencies are blocked. Escalate only for genuine owner authority, credentials, funding, legal/security approval or external access. Never represent a plan, test fixture or CI heartbeat as continuous production execution.
