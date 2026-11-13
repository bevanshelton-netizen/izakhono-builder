# IZAKHONO AI 20.0 — Worker Execution Baseline

**Implementation status:** Initial deterministic execution slice; not a complete autonomous workforce.  
**Code:** `registry/worker-execution.ts`, `registry/worker-supervisor.ts`, `registry/worker-persistent.ts`  
**Release rule:** No production promotion until runtime secrets, FORTRESS policy integration and operator acceptance are verified.

## What changed

The supervisor previously transitioned eligible queued work to `running` without invoking a worker. The current implementation invokes an explicitly registered handler before reporting execution. A worker without a registered handler remains queued with `worker-handler-not-registered`; the catalog is not misrepresented as fully executable.

Only these deterministic handlers are registered in version 1:

| Worker | Capability | Side effects |
|---|---|---|
| `portfolio-orchestrator` | Turns a goal and bounded workstream list into a draft dependency plan | None |
| `task-dispatcher` | Classifies candidate jobs by state, risk, approval gate and dependency readiness | None; returns a plan only |
| `evidence-collector` | Normalizes structured evidence references and labels them unverified | None |

These are deterministic code handlers, not a claim that every catalog worker is backed by an autonomous AI model or external tool.

## Execution lifecycle

1. The supervisor checks job state, dependencies, risk, human gate and handler registration.
2. A dry run returns a preview and performs no state transition or handler execution.
3. An executable job is claimed with one conditional D1 `UPDATE ... WHERE status='queued' RETURNING ...`; only one concurrent caller can win. The claim records a unique lease token, claimant and expiry before invoking its registered handler. The authorized executor receives the lease token for renewal and QA hand-off. Execution records structured output plus a SHA-256 digest of the input.
4. Execution evidence is explicitly marked `verified: false`. It does not complete the job.
5. Independent verification is required to move the job to `verified`.
6. A separate completion evidence step is required to move the job to `completed`. State transitions use conditional updates to reject concurrent stale-state writes.

Unsupported handlers are not started. High-risk or human-gated jobs remain blocked. Handler failures are recorded and transition the job to `failed`.

## FORTRESS capability grants

Worker execution now fails closed unless the job input carries a valid FORTRESS-signed capability grant and the runtime has `FORTRESS_CAPABILITY_SECRET` configured. The grant is an HMAC-SHA-256 signed payload with issuer `IZAKHONO-FORTRESS`, audience `IZAKHONO-WORKER-SUPERVISOR`, an exact worker subject, explicit `execute` action, matching risk class, unique grant ID, and a maximum 15-minute lifetime. The supervisor checks signature, issuer, audience, worker, action, risk, not-before and expiry before it claims or invokes a handler. The verifier secret must be provisioned only through runtime secret management; it is never committed. The current repository implements grant verification, not a production FORTRESS grant-issuing service or key-rotation/revocation registry. No worker should be issued a grant until the authoritative FORTRESS issuer and its key custody process are operational.

## Credential separation

The persistent worker runtime now fails closed for private control-plane endpoints unless `REGISTRY_TOKEN_SHA256` is configured and the request presents the matching bearer token.

The `/workers/verify` route additionally requires a separately configured `QA_VERIFIER_TOKEN_SHA256`. The ordinary registry bearer token alone cannot promote a running job to verified. Store only SHA-256 hashes in Worker environment configuration; do not commit plaintext tokens. The QA token must be provisioned through the runtime's secret-management interface before independent verification can be used. Verification additionally requires the active, unexpired per-job lease token; it atomically stores verification evidence, advances `running` to `verified`, and clears the lease. `/workers/renew` only extends a lease when the caller presents its current unexpired token.

This credential separation is a control boundary, not a substitute for full FORTRESS workload identity, approver identity, signed evidence provenance or role-based policy integration. Those remain required before production release.

## Validation

The repository CI runs registry TypeScript checks, supervisor contract tests, registry tests and a Wrangler dry run. A passing dry run does not establish a production deployment, live secret configuration, D1 migration state or customer acceptance.

## Remaining work

- Implement and test durable claim/lease semantics for concurrent cron invocations.
- Add a retry policy, lease expiry, bounded attempts and dead-letter review.
- Implement the authoritative FORTRESS grant issuer, key rotation/revocation and authenticated workload identity; current code verifies signed grants but does not issue them.
- Add replay prevention using a durable consumed-grant/JTI ledger before enabling sensitive side effects.
- Require independently authenticated verifier identity and structured test evidence.
- Add typed artifact storage and immutable evidence provenance.
- Implement additional handlers one capability at a time, each with contract tests and explicit side-effect declarations.
- Add operational dashboards for queued, running, blocked, failed, verified and completed jobs.
- Validate deployed Worker configuration and D1 migrations before enabling live dispatch.
