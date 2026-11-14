# Native Builder Execution Bridge — Implementation Contract

**Project:** IZAKHONO BUILDER  
**Project ID:** IZK-AI-BLD-001  
**Status:** Engineering contract for the next implementation slice  
**Date:** 14 November 2026

## 1. Decision

Use the existing IZAKHONO Registry Worker and its D1-backed Native Builder API as the durable control-plane entry point. Use an authorised IZAKHONO Node/Node01 process as the native execution substrate for the existing Node.js Builder adapter. Do not import Node-only modules into the Cloudflare Worker.

The Cloudflare Worker is the control plane. The Node process is the execution worker. D1 is the durable source of truth for project/job state and execution evidence. Local JSON queue/state files may remain for offline development and local test fixtures, but must not be the production queue authority.

## 2. Existing assets confirmed

- Registry Worker: registry/worker-persistent.ts.
- Registry authentication: REGISTRY_TOKEN_SHA256 and bearerValid.
- Native Builder API: POST /native-builder/projects, GET /native-builder/projects/:id, POST /native-builder/jobs, POST /native-builder/jobs/:id/approve, GET /native-builder/jobs/:id.
- Durable D1 adapter: products/izakhono-native-builder/src/d1-store.ts.
- Domain lifecycle: products/izakhono-native-builder/src/index.ts.
- Existing native queue: products/izakhono-native-builder/src/queue.ts.
- Node execution adapter: autonomy/builder-adapter.mjs and autonomy/native-builder.mjs.
- Existing Node agent worker: autonomy/ai-agent-worker.mjs.
- Registry supervisor queue already has lease/heartbeat/recovery primitives in registry/supervisor-store.ts, but it is a separate queue and should not be silently conflated with native_builder_jobs.

## 3. Required end-to-end flow

1. Build Anything authenticates the customer/operator and resolves a canonical project ID.
2. The control plane creates or updates the native Builder project through the Registry API.
3. The control plane creates a durable Native Builder job with a stable idempotency key and a classified risk.
4. Routine jobs enter queued state. Sensitive, destructive, financial, external and production-release jobs remain gated until an authorised, distinct approver approves the exact job plan/digest.
5. An authenticated Node execution worker polls or receives notification of eligible jobs.
6. The worker atomically claims one job using a time-bounded lease. The claim returns an opaque lease token, worker identity, attempt number, expiry and idempotency key.
7. The worker records heartbeats before lease expiry while running. It stops execution if it loses lease ownership.
8. The worker invokes the native adapter in an isolated workspace. The adapter must not run arbitrary owner-mode shell commands. The job instruction is treated as untrusted input.
9. The worker runs build, validation, security, test and packaging stages, producing machine-readable checks and immutable artifact hashes.
10. The worker submits a result only while it owns the lease. The control plane persists result evidence and transitions the job to succeeded or failed.
11. An expired lease is recoverable. A reclaimer increments the attempt and may re-run only idempotent operations. External side effects require an idempotency key and must be separately guarded.
12. Build status, test status, artifact packaging, preview, deployment, public-live verification and customer acceptance remain separate states.

## 4. API contract to implement

All worker routes remain protected by the Registry bearer-token hash. Do not accept a token, secret or arbitrary callback URL from the build prompt.

- GET /native-builder/worker/jobs?status=queued — return only eligible queued jobs, bounded page size.
- POST /native-builder/jobs/:id/claim — atomically claim a job for a named registered worker; return lease metadata once.
- POST /native-builder/jobs/:id/heartbeat — extend a live lease only when token hash, job, worker and current lease match.
- POST /native-builder/jobs/:id/events — append a validated lifecycle event under the active lease.
- POST /native-builder/jobs/:id/result — persist checks, artifact manifest and terminal outcome under the active lease.
- GET /native-builder/jobs/:id — return current state and evidence to authorised operators.
- POST /native-builder/jobs/:id/approve — preserve distinct-approver and digest-bound approval rules.

The token must never be stored in D1 or returned in logs. Store only a one-way hash of the lease token. Compare hashes in constant time where practical. Never accept a lease token from a different job or worker.

## 5. Persistence changes

Before adding migrations, inspect the repository's current migration sequence and the remote D1 migration ledger. Do not guess the next migration number or edit an already-applied migration.

The new schema must support:
- registered worker identity and status;
- job idempotency key with unique constraint;
- lease token hash, worker ID, leased_at, heartbeat_at and expires_at;
- attempt count and maximum attempts;
- append-only job event history;
- execution evidence and artifact manifest/hash;
- failure reason, retry eligibility and dead-letter state;
- approval identity, exact plan/artifact digest and timestamp.

A conditional atomic update must be the claim authority. A prior SELECT followed by an unconditional UPDATE is not a safe claim. Expired leases must be reclaimable without permitting two active workers to own the same job.

## 6. Native adapter contract

The existing native adapter uses Node.js filesystem and child-process facilities. It must execute only on a registered, eligible IZAKHONO execution node. The adapter should receive:
- immutable job ID and attempt;
- canonical project ID;
- instruction and approved plan digest;
- allowed action list;
- workspace root allocated by the worker;
- timeout and resource budget;
- explicit network-egress policy;
- idempotency key.

The adapter returns:
- status;
- provider = izakhono-native;
- generated artifact path relative to the job workspace;
- SHA-256 artifact manifest;
- named validation/security/test checks;
- warnings and deterministic fallback mode;
- no claims of public deployment.

Artifact paths must be confined to the assigned workspace. Reject traversal, symlinks escaping the workspace and unapproved executable scripts. Do not pass arbitrary strings to a shell; use allowlisted executables and argument arrays.

## 7. Reliability and recovery

- Worker heartbeat interval must be shorter than one-third of lease duration.
- Worker must stop and not submit a result after lease loss.
- A process restart must not silently lose the job or create a second external side effect.
- Reclaim must append a recovery event and increment the attempt.
- Retry only retryable failures; validation/security failures require a new plan or explicit remediation.
- After bounded attempts, move to failed/dead-letter with actionable reason.
- Duplicate result submission must be idempotent and return the existing terminal result.
- Operator cancellation must be durable and observed by workers.
- Queue metrics must include oldest queued age, active leases, expired leases, retry count, dead-letter count and worker heartbeat age.

## 8. Security and governance

- Registry API uses a server-side bearer credential; never expose it to browser code.
- Worker identity is registered and can be revoked.
- Worker API routes do not accept arbitrary worker IDs as authority; identity must be bound to the credential or signed worker registration.
- Production deployment, DNS, payment, domain registration, external publication, destructive changes and security exceptions remain separate approval-gated operations.
- Approval binds to exact job plan digest. Any material plan change invalidates approval.
- Generated code runs in an isolated workspace with resource limits and default-deny network egress.
- No generated code runs inside the Registry Worker process.
- Audit records identify actor, worker, job, attempt, lease and artifact digest.
- Customer data and secrets are not copied into logs or model prompts unnecessarily.

## 9. Acceptance tests

1. Concurrent workers race for one queued job; exactly one receives a lease.
2. A second claim while a lease is live is rejected.
3. Wrong worker, wrong token and wrong job cannot heartbeat or submit results.
4. Lease expires; another eligible worker reclaims it and the attempt increments.
5. Previous lease holder cannot submit after expiry/reclaim.
6. Worker crashes after claim; job is recovered after lease expiry.
7. Duplicate idempotent submission returns the existing result without repeating side effects.
8. Unapproved high-risk job cannot be claimed.
9. Requester cannot approve their own sensitive job.
10. Changed plan digest invalidates prior approval.
11. Artifact path traversal and symlink escape are rejected.
12. Failed security/test check cannot result in succeeded.
13. Artifact hashes and evidence are retained and retrievable.
14. Customer-facing Build Anything can show persisted job progress without fabricated states.
15. Public deployment and customer acceptance are not inferred from successful packaging.

## 10. Immediate implementation sequence

1. Inspect root migration files and remote D1 migration ledger.
2. Add lease-aware D1 schema and tests.
3. Add authenticated Registry claim/heartbeat/event/result endpoints.
4. Add a Node worker client using the Registry API; keep local JSON worker mode for development only.
5. Integrate native adapter with the durable worker and artifact manifest.
6. Connect Build Anything to the existing Registry project/job API through a server-side service binding or authenticated server-to-server call.
7. Add end-to-end tests and run CI.
8. Promote only after the complete lease/recovery/security acceptance suite passes.

## 11. Explicit non-goals

- No Hercules runtime, account, credits or required API.
- No direct import of Node fs/child_process modules into Cloudflare Worker code.
- No public production deployment in this slice.
- No replacement of the existing customer-facing Builder until parity is verified.
- No destructive database migration, existing project deletion or data copy without a reviewed rollback plan.
