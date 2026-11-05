# IZAKHONO J.A.R.V.I.S.

IZAKHONO-owned intelligent command centre for the IZAKHONO ecosystem.


## Immutable action proposals and owner decisions

The current foundation now includes an owner-only proposal register. A proposal stores a canonical JSON payload, SHA-256 fingerprint, action type, target, optional linked task and 24-hour expiry. The owner can inspect, approve, reject or cancel a proposal in the command centre. Decisions are tenant/owner scoped, hash-checked, expiry-checked and recorded in an append-only decision table plus audit events. A conditional state transition ensures only one concurrent decision can win.

**Approval is not execution.** No external tool adapter is enabled. Approved proposals cannot send email, change customer records, initiate payments, publish content, deploy software or perform any other side effect. A future adapter must consume the exact approved fingerprint once, enforce idempotency and revalidate the target and expiry before execution.

## Product objective

A voice-first, multimodal AI operating system that can understand owner instructions, retrieve authorized business context, coordinate specialist agents, and execute approved workflows with auditable evidence.

## Current milestone: Secure foundation and reasoning-only agent orchestration

This branch contains the product specification, security boundaries, authenticated owner sessions, D1 conversation and memory persistence, a server-side reasoning gateway adapter, specialist agent registry, durable task queue and connected command-centre interface.

**Important:** These are source-code capabilities in a feature branch. They are not production-deployed or verified live. Model reasoning requires its Worker bindings; agent tasks require an authenticated session and an explicit Run action. External tools and business actions are not enabled.

## Architecture

`Owner / authorized user → JARVIS interface → identity & policy gateway → orchestration engine → specialist agents → approved tools → evidence & audit log`

Core subsystems:

- **Experience:** responsive command centre, keyboard input, optional browser speech recognition, accessible status and activity views.
- **Identity and policy:** authenticated users, roles, scoped permissions, explicit approval for consequential actions.
- **Intelligence gateway:** provider-neutral model interface; model/provider selection stays server-side and replaceable.
- **Memory:** tenant-scoped, searchable records with provenance, retention controls, correction and deletion workflows.
- **Orchestration:** durable task graph, retries, timeouts, idempotency, cancellation and human approval gates.
- **Tools:** separately permissioned adapters for web research, files, repositories, email, calendars, business systems and deployments.
- **Evidence:** append-only action events, tool results, approvals, verification results and artifact references.
- **Infrastructure:** IZAKHONO-owned runtime first; external services are replaceable adapters, not the system of record.

## Non-negotiable safety rules

1. Never put provider credentials, admin secrets or service-role keys in browser code.
2. Treat model output, retrieved documents, webpages and tool results as untrusted data.
3. No arbitrary shell execution, unrestricted computer control, or open-ended tool access.
4. Require explicit confirmation for sending messages, spending money, publishing, deleting, changing access, or production deployment.
5. Apply least privilege, per-tool scopes, rate limits, audit records and idempotency keys.
6. Never represent a simulated capability as connected or live.
7. Store business memory by tenant and access scope; support retention and owner-controlled export/deletion.
8. The assistant may prepare consequential actions, but must pause at the approval gate before executing them.

## Persistence and intelligence gateway foundation

The Worker now exposes an owner-authorized D1 persistence API in `src/jarvis.ts`. It creates its own tables idempotently and scopes rows to the IZAKHONO tenant and owner identity. It supports conversation creation and listing, message history, idempotent user-message submission, owner-entered company/project/private memory, memory search and audit events.

When the existing server-side IZAKHONO SUPER AI workflow bindings are configured, message submission calls the reasoning workflow and persists the assistant response. Credentials remain server-side. Without those bindings, user messages are persisted and the API truthfully reports that intelligence is not connected. No external tools are exposed to the model in this milestone.

Run `npm run jarvis:validate` to type-check the API, run the agent orchestration contract tests and validate browser JavaScript syntax. The API accepts either the existing Builder owner authorization check or a J.A.R.V.I.S.-specific short-lived browser session. Browser sessions use a dedicated `JARVIS_LOGIN_SECRET` Worker secret, random opaque tokens, SHA-256 token hashes in D1, an eight-hour expiry, HttpOnly/Secure/SameSite=Strict host-only cookies, same-origin checks on mutations, and a per-IP-hash login throttle. The login secret is never placed in browser code. Configure `JARVIS_LOGIN_SECRET` in the Worker secret store before enabling browser sign-in; do not commit it to source or put it in a frontend environment variable. The static preview remains available when the dedicated secret is not configured and does not claim a live connection.

## Agent orchestration milestone

The current agent engine adds a durable D1 task queue and a small specialist-agent registry: J.A.R.V.I.S. Coordinator, Business Analyst, Research Briefing Agent, Project Planner and Reporting Agent. Tasks are tenant/owner scoped, type-checked against the selected agent, idempotent when a client key is supplied, prioritized, auditable and tracked through queued, running, retry-wait, completed, failed and cancelled states. A conditional database update claims queued work to reduce duplicate execution. Recoverable reasoning-gateway failures receive bounded exponential retry windows (up to three attempts).

The owner API exposes agent discovery, task creation/listing/detail, explicit run and cancellation endpoints under `/api/jarvis/v1/agents` and `/api/jarvis/v1/tasks`. The command-centre now includes an Agent Workspace for queuing and running tasks and viewing results.

**Execution boundary:** these agents are currently reasoning-only. They have no web, email, filesystem, shell, repository-write, payment, CRM, publishing or deployment tools. A task runs only when the owner explicitly selects Run agent. Cancellation marks the durable task cancelled; it cannot forcibly terminate a model request already in flight, and any late result is discarded. Automatic background dispatch and parallel worker execution are not enabled yet. Consequential tools require a separate immutable action proposal and owner approval workflow before any adapter is connected.



## Background task dispatcher — scheduled D1 workers

The Builder Worker now has a one-minute Cron Trigger and a scheduled handler that dispatches eligible J.A.R.V.I.S. tasks directly from the durable D1 queue. D1 remains the source of truth; no separate queue service or paid per-message broker is required for this first owned-runtime worker.

Each scheduled invocation selects up to three eligible tasks, prioritising high then normal then low priority. It claims each task with a conditional D1 update before execution and runs the claimed batch concurrently. Duplicate scheduled invocations cannot claim the same task. Existing bounded retry windows and terminal failure rules are retained. Cancellation is checked after model work returns, and cancelled work is not committed as completed.

**Operational limits:** this is bounded parallelism of up to three reasoning tasks per cron invocation, not an unlimited worker pool. The one-minute schedule, Cron Trigger activation and configured AI gateway bindings must be present in the deployed Worker before it can operate. The feature branch itself is not deployed. A task may remain queued until the scheduled handler is active; the owner can still use the explicit Run agent endpoint.

## Controlled action execution — first internal adapter

The action register now has a conservative execution endpoint and a unique D1 execution ledger. The server accepts execution only for an approved, unexpired proposal whose stored canonical JSON still matches its SHA-256 fingerprint and the caller-supplied expected hash. The only enabled adapter is `jarvis.audit.record` for target `izakhono-jarvis.audit`; it accepts a single note string and writes an internal audit annotation. It does not contact external systems.

The execution ledger is unique per proposal. A completed repeat returns the stored result; a previously claimed but incomplete execution is blocked for recovery review rather than automatically replayed. Unsupported action types and targets are rejected. There are still no email, payment, CRM, publishing, deployment, arbitrary HTTP or shell adapters. This is the first controlled adapter, not general-purpose automation.


## Scheduled agent dispatch and task dependencies

The Worker now exposes a scheduled dispatcher through its Cloudflare Worker `scheduled` lifecycle handler. The root Worker configuration schedules a one-minute cron. Each invocation reads a bounded batch of up to three eligible tasks from D1 and claims each with a conditional update before running specialist reasoning concurrently. D1 remains the source of truth; duplicate scheduler invocations cannot claim the same queued attempt.

Tasks may declare up to 20 `depends_on` task IDs at creation. Dependencies must already exist and belong to the same owner and tenant. Manual and scheduled execution both wait until all prerequisites complete. If a prerequisite fails or is cancelled, the dispatcher marks dependent queued work failed with `dependency-failed` rather than leaving it stuck. Retries remain bounded by the existing attempt limit and backoff policy.

This is bounded scheduled concurrency, not an unlimited agent swarm. It is only active after the Worker is deployed with the updated configuration and required SUPER AI bindings. It does not grant agents external tools or write access.

## API contract (initial)

- `GET /api/jarvis/v1/status` — service readiness and enabled capability flags; never expose secrets.
- `GET/POST /api/jarvis/v1/conversations` — list and create authorized conversations.
- `GET/POST /api/jarvis/v1/conversations/:id/messages` — retrieve history and submit a message; responses are currently non-streaming.
- `GET /api/jarvis/v1/agents` — list registered reasoning-only specialists.
- `GET/POST /api/jarvis/v1/tasks` — list and queue durable tasks.
- `GET /api/jarvis/v1/tasks/:id` — retrieve task status and result.
- `POST /api/jarvis/v1/tasks/:id/run` — explicitly claim and execute a reasoning-only task.
- `POST /api/jarvis/v1/tasks/:id/cancel` — mark a task cancelled.
- `GET /api/jarvis/v1/memory/search?q=...` — search only memory the caller may access.
- `POST /api/jarvis/v1/actions/:id/approve` — approve a specific immutable action proposal.
- `POST /api/jarvis/v1/actions/:id/reject` — reject a proposed action.
- `POST /api/jarvis/v1/actions/:id/cancel` — cancel a cancellable running action.

Every mutation must validate the session, tenant, permission, CSRF/origin policy where applicable, schema, idempotency key and audit requirements.

## Delivery sequence

1. Foundation UI and product contract.
2. Authenticated owner session and capability registry.
3. Provider-neutral model gateway with server-side secrets.
4. Conversation persistence and scoped memory.
5. Durable reasoning-only agent task queue and specialist registry (initial implementation).
6. Background workers, task graphs and bounded parallel execution.
7. Immutable action proposals, approval lifecycle and scoped tool adapters.
8. Read-only tools first: status, search, files and reporting.
9. Approval-gated write tools: email drafts, CRM updates, publishing and deployment.
10. Voice input/output and multimodal image/document understanding.
11. Security, load, recovery, accessibility and end-to-end acceptance.
12. Owned-runtime deployment after infrastructure readiness and owner acceptance.

## Local preview

Serve `public/jarvis/index.html` through the existing IZAKHONO Builder static asset runtime, or open it directly in a browser. Browser speech recognition depends on browser support and permission. The preview uses demo data only.

## Release status

Source is in the feature branch and draft PR #585. This is not a production deployment and does not establish that J.A.R.V.I.S. is publicly reachable.
