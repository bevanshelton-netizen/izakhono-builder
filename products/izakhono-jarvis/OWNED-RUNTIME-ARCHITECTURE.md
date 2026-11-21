# J.A.R.V.I.S. — IZAKHONO-Owned Runtime Architecture

**Decision:** J.A.R.V.I.S. production runtime belongs on IZAKHONO HOST / Runtime Fabric. Cloudflare Workers, D1, Wrangler deployment, and Cloudflare credentials are not production prerequisites.

**Current state:** the command-centre routes and workforce queue are integrated in Builder mainline. The Node 22 HTTP adapter and PostgreSQL compatibility adapter are now implemented under `products/izakhono-jarvis/runtime/`; their SQL translation, schema installation and claim-to-owner-review lifecycle pass against disposable PostgreSQL 17 in CI. The explicit schema installer is not run at API startup. This repository state does not prove that an IZAKHONO-owned production database or execution host has been configured, that existing data has been migrated, or that a production service is running. The worker bridge and bounded supervisor exist, but no real private executor is connected.

## Target service topology

- **J.A.R.V.I.S. API:** Node 22 service, private service network, owner-authenticated routes.
- **J.A.R.V.I.S. workforce supervisor:** separate bounded process; one pass per invocation, approved agent allowlist, concurrency capped at five.
- **J.A.R.V.I.S. executor:** separate private HTTPS service implementing `izakhono.jarvis.executor/v1`, durable idempotency, scoped capabilities and evidence.
- **DATABASE:** IZAKHONO-owned PostgreSQL as durable system of record for tasks, context, conversations, approvals, orchestration, leases and audit events.
- **OBJECT STORAGE:** owned object storage for bounded artifacts and evidence where required; database stores references and integrity metadata.
- **EDGE:** IZAKHONO-controlled Caddy ingress; expose only the approved J.A.R.V.I.S. API route. Supervisor, executor and database remain private.
- **FORTRESS:** runtime-only secrets, owner identity, service-to-service credentials, audit retention, rate limits, backups and restore verification.
- **PROVISIONER:** immutable image release, schema compatibility check, health/readiness gate, controlled promotion and rollback.

NODE01–NODE04 remain IZAKHONO software-node identities. A workload is assigned to a physical/virtual execution host only after that host is independently verified. A repository label is not host evidence.

## Required migration work

1. **Runtime adapter:** replace the Worker entrypoint dependency with a Node HTTP adapter while preserving the existing route modules and owner authorization boundary.
2. **Database adapter:** replace the D1 `prepare/bind/all/first/run` contract with a typed repository layer backed by PostgreSQL. Translate and review migrations 0025–0031; do not mechanically replay SQLite/D1 SQL against PostgreSQL.
3. **Data integrity:** preserve owner scope, unique identifiers, dependency checks, lease expiry, retries, approvals, evidence and immutable audit history. Define a verified import/export path before moving any existing production data.
4. **Executor:** deploy a real executor implementing the existing contract. Persist idempotency keys and outcomes atomically. No mock executor may satisfy production acceptance.
5. **Private service identity:** replace shared broad owner-secret use for service-to-service operations with a restricted workload identity. Keep owner-only administrative operations distinct from worker claims.
6. **Operations:** add startup/readiness/liveness probes, structured redacted logs, backup/restore, schema compatibility, graceful shutdown, resource limits and immutable image rollback.
7. **Edge and acceptance:** keep API private until owner authentication, TLS, database, executor, audit, recovery and external smoke tests pass.

## Non-negotiable execution boundaries

- A workforce claim is a lease, not proof of execution.
- A completed task remains pending owner verification until the owner reviews its evidence.
- External actions (payments, purchases, messages, account changes, production changes) require a separately recorded owner approval and an authorised bounded adapter.
- No arbitrary shell, unrestricted network, unrestricted filesystem, or general-purpose host administration is exposed to agents.
- The executor validates the agent, task, capability, approval, idempotency key and input bounds on every request.
- Failed, ambiguous, timed-out or unverifiable work is not reported as completed.
- Missing configuration fails closed; no automatic fallback to a third-party runtime.

## Release states

| State | Meaning |
|---|---|
| `SOURCE_VALIDATED` | Existing route, workforce, supervisor and original SQLite migration tests pass. |
| `RUNTIME_ADAPTER_IMPLEMENTED` | Node 22 API adapter and PostgreSQL compatibility/schema code exist; disposable PostgreSQL 17 integration tests pass. |
| `RUNTIME_ADAPTER_READY` | Owned production PostgreSQL, production-role permissions, backup/restore, and environment-specific integration tests are verified. |
| `EXECUTOR_VERIFIED` | Real private executor passes contract, idempotency and authorization tests. |
| `DEPLOYED_HEALTHY` | Immutable release is running on a verified owned execution host and health checks pass. |
| `LIVE_VERIFIED` | Owner acceptance, security, data, backup/restore, EDGE/TLS and external smoke evidence all pass. |

CI can establish source validation only. It must never promote J.A.R.V.I.S. to `DEPLOYED_HEALTHY` or `LIVE_VERIFIED`.
