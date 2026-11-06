# J.A.R.V.I.S. API Contract — v1

This contract separates the currently implemented persistence/session routes from future orchestration contracts. The current Worker implementation is not yet covered by a completed integration-test run.

## Common response envelope

```json
{ "ok": true, "data": {}, "request_id": "req_..." }
```

Errors use `{ "ok": false, "error": { "code": "...", "message": "..." }, "request_id": "..." }`.

## Owner session (implemented)

- `GET /api/jarvis/v1/session` — reports whether the browser has a valid owner session and whether login is configured.
- `POST /api/jarvis/v1/session/login` — validates the dedicated server-side `JARVIS_LOGIN_SECRET` and issues an eight-hour opaque session cookie.
- `POST /api/jarvis/v1/session/logout` — revokes the current session and clears its cookie.

The cookie is host-only (`__Host-`), `HttpOnly`, `Secure`, and `SameSite=Strict`. Only its SHA-256 hash is stored in D1. Login and authenticated mutations require HTTPS and a same-origin `Origin`; failed logins are throttled by a hash of Cloudflare's connecting IP. Configure the credential as a Worker secret; never place it in browser code.

## Status

`GET /api/jarvis/v1/status`

Returns readiness, build version and non-sensitive capability flags. Distinguish `available`, `configured`, `degraded` and `disabled`. Never return secrets or raw environment values.

## Conversation (implemented baseline)

`GET /api/jarvis/v1/conversations` lists the owner's recent conversations. `GET /api/jarvis/v1/conversations/:id/messages` retrieves the authorized conversation history. `GET/POST /api/jarvis/v1/memory` reads or creates owner-entered scoped memory; `GET /api/jarvis/v1/memory/search?q=...` searches it.

## Conversation (future streaming contract)

`POST /api/jarvis/v1/conversations`

Creates a conversation within the caller's authorized tenant.

`POST /api/jarvis/v1/conversations/:id/messages`

Request:
```json
{ "text": "Summarise my business operations", "client_message_id": "uuid" }
```

Response should stream typed events: `message.delta`, `tool.proposed`, `approval.required`, `tool.started`, `tool.completed`, `message.completed`, `error`.

## Agent registry and task queue (implemented baseline)

- `GET /api/jarvis/v1/agents` — returns the registered specialist agents, supported task types and declared tool boundary. Current agents are reasoning-only and have no live tools.
- `GET /api/jarvis/v1/tasks?status=queued` — lists the authenticated owner's tasks.
- `POST /api/jarvis/v1/tasks` — creates a task with `agent_id`, `task_type`, `title`, `instruction`, optional `priority`, `idempotency_key`, up to 20 owner-validated `context_ids`, and up to 20 owner-validated `depends_on` task IDs.
- `GET /api/jarvis/v1/tasks/:id` — retrieves the task and result.
- `POST /api/jarvis/v1/tasks/:id/run` — explicitly claims and runs a queued task using the server-side reasoning gateway.
- `POST /api/jarvis/v1/tasks/:id/cancel` — marks a non-terminal task cancelled. An in-flight model request cannot be forcibly stopped; its late result is discarded.

Task states: `queued`, `running`, `retry_wait`, `completed`, `failed`, `cancelled`. Recoverable gateway failures use bounded exponential retry windows, up to three attempts. Task claims use a conditional database update to prevent two callers from claiming the same queued attempt.

No task endpoint can invoke email, web, shell, filesystem, repository mutation, payment, CRM, publishing or deployment tools. The scheduled dispatcher supports bounded concurrency of up to three tasks per cron invocation; it is active only after the configured Worker is deployed.

## Action approval

`POST /api/jarvis/v1/actions/:id/approve`

Request:
```json
{ "approval_token": "one-time-token", "expected_payload_hash": "sha256:..." }
```

The server rechecks actor, tenant, permission, expiry, payload hash, target and action status. Approval is single-use.

## Immutable action proposals (implemented baseline)

These endpoints record owner decisions only. They do not execute, dispatch or trigger an external action.

- `GET /api/jarvis/v1/actions` — lists the authenticated owner's proposals.
- `POST /api/jarvis/v1/actions` — creates a proposal with `action_type`, `target`, object `payload`, and optional owner-owned `task_id`. The server canonicalises JSON object keys and stores a SHA-256 payload hash. Proposals expire after 24 hours.
- `GET /api/jarvis/v1/actions/:id` — returns the proposal and immutable payload.
- `POST /api/jarvis/v1/actions/:id/approve` or `/reject` — requires `expected_payload_hash` matching the displayed hash and an optional note. The transition is conditional on the still-proposed state, owner, tenant, hash and unexpired deadline; only one concurrent decision wins. A durable approval/rejection record is written.
- `POST /api/jarvis/v1/actions/:id/cancel` — cancels a proposal that is still awaiting a decision.

Statuses: `proposed`, `approved`, `rejected`, `expired`, `cancelled`. Approval is an auditable authorisation record, not execution permission for a generic tool runner. A future adapter must independently validate the exact action type, target, payload hash, expiry, one-time consumption and idempotency before carrying out any side effect. No adapter is enabled in this milestone.

## Scoped action execution (implemented initial adapter)

- `POST /api/jarvis/v1/actions/:id/execute` — consumes an approved, unexpired proposal only when the caller supplies its exact `expected_payload_hash`. The server re-hashes the stored canonical payload and validates tenant, owner, status and expiry.
- The only enabled adapter is `jarvis.audit.record` targeting `izakhono-jarvis.audit`. Its payload must contain exactly one `note` string (maximum 500 characters). It writes an internal audit annotation; it does not contact an external system.
- A unique execution ledger row keyed by proposal ID prevents a second execution claim. A completed repeat returns the stored result. A claimed-but-incomplete record is blocked for recovery review rather than automatically re-run.
- Every other action type or target returns an unsupported-adapter response. There are no email, payment, CRM, publishing, deployment, arbitrary HTTP or shell adapters.

The execution ledger is deliberately conservative: a crash after claiming but before completing can leave a `claimed` record. This prevents accidental duplicate side effects; a later recovery workflow must reconcile the record before retrying.

## Background dispatch

The Worker Cron Trigger runs every minute and invokes the J.A.R.V.I.S. scheduled dispatcher. It reads eligible `queued` and due `retry_wait` tasks from D1, claims at most three per invocation with conditional `UPDATE ... RETURNING`, and executes the claimed reasoning tasks concurrently. D1 remains the durable source of truth; duplicate invocations cannot claim the same task. Existing bounded retry and cancellation semantics apply. This is bounded concurrency, not an unlimited worker pool. It becomes operational only after the Worker with the Cron Trigger is deployed and the server-side AI gateway bindings are configured. Explicit owner Run remains available.


### Task dependencies

- `POST /api/jarvis/v1/tasks` accepts an optional `depends_on` array of up to 20 unique task IDs.
- Every prerequisite must already exist under the same tenant and owner; clients cannot reference another account's task.
- The owner-triggered Run endpoint and scheduled dispatcher both require all prerequisites to be `completed`.
- If a prerequisite reaches `failed` or `cancelled`, the scheduled dispatcher marks dependent queued work `failed` with `dependency-failed`.
- Dependency edges are persisted in `jarvis_task_dependencies`; task creation is naturally acyclic because new tasks can only depend on already-existing tasks.


## Shared company and project context

- `GET /api/jarvis/v1/context?scope=company` lists owner-scoped company context records.
- `GET /api/jarvis/v1/context?scope=project&project_id=...` lists context for a specific project.
- `POST /api/jarvis/v1/context` creates a company or project context record with a record type, title, content and optional tags.
- Company records have no project ID; project records require one. Records are always scoped to the authenticated tenant and owner.
- `POST /api/jarvis/v1/tasks` accepts an optional `context_ids` array of up to 20 record IDs. Every ID is validated against the authenticated owner before the task is created.
- Both manual and scheduled execution retrieve only the task's explicitly linked context records, re-checking tenant and owner scope. Context is labelled as reference data, not agent instructions, and capped at 16,000 characters per task.
- Context is not silently injected into unrelated tasks. No external company systems are read or modified by this feature.

## Memory

`GET /api/jarvis/v1/memory/search?q=...`

Search is always filtered by authenticated tenant, user scope, project scope and permissions. The caller cannot supply or override tenant identity in query parameters.

## Implementation requirements

- Validate every request with a runtime schema.
- Use secure session cookies and same-origin protections.
- Never trust tenant/user IDs supplied by the browser.
- Add idempotency for writes and deduplicate client retries.
- Log structured events without secrets or unnecessary personal data.
- Return no stack traces or provider errors to clients.


## Owner-facing context manager

The authenticated command centre includes a Context Manager. Owners can create company-wide or project-specific records, choose a record type, add tags, filter the library and refresh it. Each record card has an explicit checkbox to attach that record to the next task submission. The task form submits only checked record IDs; the server validates every ID against the current owner and tenant before creating the task. The UI does not offer deletion or editing because retention and correction policy is not yet defined.


## Executive intelligence snapshot

- `GET /api/jarvis/v1/executive` returns owner-scoped task counts, action proposal counts, company/project knowledge counts, latest knowledge update, query timestamp and source readiness.
- The endpoint aggregates only J.A.R.V.I.S. D1 records. Finance, email, CRM, manufacturing and education connectors are explicitly reported as not connected and not authorised until separately configured.
- No external company KPIs are estimated or inferred. Each response includes scope and limitations; source freshness is reported separately from record update time.


## Read-only source connector contract (Phase 11)

The Executive Snapshot may incorporate additional sources only through an explicitly configured, read-only connector. An unconfigured connector MUST remain `not-connected`; an error MUST be reported as `error` rather than silently falling back to stale figures.

Each connector response must provide:

```json
{
  "source_id": "github",
  "account_scope": "explicitly-authorised-account-or-repository",
  "permission": "read-only",
  "status": "connected",
  "observed_at": "2026-11-06T09:00:00Z",
  "source_updated_at": "2026-11-06T08:59:00Z",
  "freshness": "current",
  "metrics": {},
  "limitations": []
}
```

Rules:
- `observed_at` means when IZAKHONO queried the source; `source_updated_at` is a timestamp reported by the source. Never substitute one for the other.
- Allowed statuses are `not-connected`, `connected`, `stale`, `error`, and `permission-denied`. Only verified, authorised data can be `connected`.
- Every metric must include an explicit source and scope. No cross-company financial totals or comparisons may be produced without a verified common period, currency, entity mapping and reconciliation policy.
- Connector credentials must remain server-side. No provider tokens, personal messages or raw financial transactions may be exposed in the command-centre browser.
- Owner permission to view the command centre is not, by itself, authorisation to access an external account. Select and authorise each account and dataset independently.
- An integration must not send email, update records, move funds, publish content, change infrastructure or deploy code.
- Missing source permissions must not be bypassed by scraping or by reading a different account.
- The current implementation's Executive Snapshot remains D1-only. This section specifies a future integration boundary; it does not claim any external connector is live.
