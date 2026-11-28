# IZAKHONO INTEGRATION FABRIC — PHASE 0 REPOSITORY AUDIT V1

**Date:** 25 November 2026  
**Repository reviewed:** `bevanshelton-netizen/izakhono-builder`  
**Baseline:** `main` at `77bf4559925d0dc231bfb2abae126e385f973520`  
**Status:** Repository-source audit; runtime deployment and infrastructure were not inspected or independently verified  
**Purpose:** Determine what can be reused for Integration Fabric without duplicating or overstating existing capabilities.

---

## 1. Executive finding

The repository contains a substantive **IZAKHONO Super Engine** implementation, including an in-process module ServiceBus, a payment-processing fabric, payment-specific durable persistence adapters, PostgreSQL queue implementations in the Provisioner, and a PostgreSQL event store in Runtime Fabric.

However, the current `products/izakhono-super-engine/src/service-bus.ts` is an **in-memory synchronous module message dispatcher**, not a durable, multi-tenant enterprise integration bus. It is a useful internal messaging prototype/foundation, but it does not yet meet the reliability, external connectivity, governance, or operational requirements of IZAKHONO INTEGRATION FABRIC.

The repository's Super Engines architecture document explicitly describes a target engineering contract and says not every engine is implemented or production-live. Its Super Queue Engine is a target capability, not proof that a generic durable event bus already exists.

**Decision:** Reuse the existing Super Engine codebase and selected queue, persistence, webhook and audit patterns. Do not simply relabel the current ServiceBus as the Integration Fabric backbone. Do not build a second unrelated engine. Define a versioned transport-neutral contract, then evolve a durable, governed messaging layer behind it.

## 2. Repository evidence inventory

The following assets were found on the reviewed `main` tree:

| Asset | Evidence | Audit classification |
|---|---|---|
| Super Engine module registry | `products/izakhono-super-engine/src/modules.ts`, `types.ts` | Implemented static module catalogue (20 module identifiers) |
| Super Engine coordinator | `src/engine.ts`, `engine.test.ts` | Implemented module metadata and evolution proposal state; not a distributed orchestrator |
| ServiceBus | `src/service-bus.ts`, `service-bus.test.ts` | Implemented in-process synchronous dispatcher |
| Payment event model | `src/payment-events.ts` | Implemented event contract and in-memory store |
| Payment persistence | `src/payment-events-supabase.ts`, `payment-durable.ts`, related adapters | Implemented Supabase REST adapters for payment-specific records |
| Webhook idempotency | `src/payment-webhook-claims-supabase.ts`, SQL migration `004_durable_webhook_claims.sql` | Implemented atomic claim pattern backed by a database uniqueness constraint |
| Payment/refund recovery | `src/payment-refund-recovery-worker.ts`, related SQL and adapters | Implemented payment-domain recovery/lease patterns |
| Payment schema | `sql/001_payment_fabric.sql` and subsequent migrations | Implemented payment-specific PostgreSQL schema, not generic integration event storage |
| Provisioner queue | `infra/provisioner/postgres_job_queue.py`, `postgres_queue.py` | Implemented PostgreSQL job queue patterns tied to Provisioner jobs |
| Runtime event store | `infra/runtime-fabric/controller/postgres_event_store.py` | Implemented append-only runtime audit-event store; not a message broker |
| Freight event-bus prototype | `apps/izakhono-nav/shelton-freight-operations-event-bus.*` | Application-specific workflow/event prototype |
| Vehicle integration layer | `apps/izakhono-nav/vehicle-integration-layer.*` and safety/security contracts | Application-specific integration layer |
| Owned Super Engine packaging | `Dockerfile`, `infra/app-fabric-runtime/super-engine.compose.yml` | Container and deployment configuration present in source |
| Owned release workflow | `.github/workflows/super-engine-owned-deploy.yml` | Workflow definition present; does not prove that the required runner or production route is operational |
| Super Engines target architecture | `docs/IZAKHONO-SUPER-ENGINES-V1.md` | Target architecture and non-implementation caveat |
| Super Engines benchmarks | `docs/IZAKHONO-SUPER-ENGINES-BENCHMARKS-V1.md` | Benchmark plan and target SLOs, not measured performance evidence |

## 3. ServiceBus implementation assessment

### What exists

The current `ServiceBus`:
- registers a fixed set of typed Super Engine module identifiers;
- supports in-process subscriptions by destination module;
- dispatches messages to destination handlers;
- has a configurable maximum JSON payload size;
- can apply an explicit source/destination/topic route allowlist;
- can call a FORTRESS policy hook;
- can call an audit hook;
- denies external messages by default.

This is useful for controlled module-to-module communication within one process.

### Material gaps against Integration Fabric requirements

| Requirement | Current evidence | Finding |
|---|---|---|
| Durable message persistence | Handler sets and module registry are process memory | **Missing** |
| Multi-instance delivery | No shared broker/store or consumer coordination in ServiceBus | **Missing** |
| Queue leases and crash recovery | Not in ServiceBus | **Missing** |
| Retry/backoff/dead-letter | Not in ServiceBus | **Missing** |
| Idempotency and deduplication | Message ID exists but is not persisted or deduplicated by ServiceBus | **Missing** |
| Tenant and environment scope | Message has no tenant/environment identity | **Missing** |
| Schema/version registry | Topic is a string; no schema version or contract validation | **Missing** |
| Correlation/trace context | No correlation, causation or trace fields | **Missing** |
| External connector transport | `external` is a boolean gate; destinations remain internal module IDs | **Missing** |
| FORTRESS mandatory enforcement | Hook is optional; bus can be constructed without it | **Gap — production must fail closed** |
| Audit mandatory enforcement | Audit hook is optional | **Gap — production must fail closed** |
| Topic-specific subscription | Handlers are registered by destination module; topic filtering is left to handlers | **Partial** |
| Backpressure and concurrency limits | Handlers execute sequentially in the publishing process | **Missing** |
| Delivery outcome semantics | Handler exception interrupts dispatch; no durable partial-delivery record or recovery | **Missing** |
| Payload validation | JSON byte size is checked; schema, field and classification validation are absent | **Partial** |
| Route policy | Optional exact-string route allowlist; empty list means no route restriction beyond known modules | **Partial** |

Additional reliability consideration: delivery and audit are not one atomic operation. A handler can perform a side effect and the subsequent audit hook can fail, leaving the caller with an error despite a completed side effect. Durable delivery receipts and idempotent consumer semantics are required.

### Health endpoint assessment

`engine.ts` derives readiness from static module metadata (module count, required flags, FORTRESS-protected flags and I-NET architecture label). It does not probe a live FORTRESS authority, durable queue, database, connector runtime, worker pool or event-delivery path.

The existing `/health` response is therefore a **process/module-contract health signal**, not sufficient evidence that the future Integration Fabric is operational or production-ready. Readiness should be split into liveness, process readiness and dependency/capability readiness with explicit checks.

## 4. Existing durable patterns worth reusing

### 4.1 Provisioner PostgreSQL queues

The Provisioner includes PostgreSQL queue code using row locking and `FOR UPDATE SKIP LOCKED`, leases, attempts, delayed availability and expired-lease recovery.

Reuse the proven design patterns, not the Provisioner-specific tables as-is. These queues are coupled to Provisioner job records and require a separate review of their completion, retry, lease-expiry and dead-letter semantics before adapting them to a general message transport.

### 4.2 Payment webhook claims

The payment webhook claim store uses a unique database key for provider plus external transaction ID and distinguishes exact duplicate outcomes from contradictory outcomes. This is a strong domain-specific idempotency pattern.

The payment SQL migrations also establish durable payment events, fulfilment jobs, ledger entries, settlement batches and reconciliation records. They must remain payment-domain models; Integration Fabric should not repurpose financial tables as generic message storage.

### 4.3 Runtime Fabric event store

The Runtime Fabric PostgreSQL event store provides append-only operational events and deployment history. It can inform Integration Fabric observability and audit interfaces, but it does not provide queue acknowledgement, consumer offsets, retries or message delivery.

## 5. Test and CI coverage findings

The repository has `service-bus.test.ts` and `engine.test.ts` files. The root package scripts reviewed expose `super-engine:payment:test` and `super-engine:payment:typecheck`.

The payment test script invokes payment-core, payment-Supabase, refund-ledger, payment-orchestrator and webhook-guard tests. It does **not** invoke `service-bus.test.ts`, `engine.test.ts` or `payment-durable-adapters.test.ts`.

The owned deployment workflow runs the payment typecheck and payment test script before building and smoke-testing the container. Consequently, the presence of ServiceBus tests in the repository must not be represented as proof that those tests are included in the current owned deployment gate.

**Required improvement:** Add an explicit Super Engine core test/typecheck suite that executes the ServiceBus and engine tests, plus durable adapter contract tests. Keep payment-specific tests as a separate suite.

## 6. Runtime and deployment evidence boundary

The repository contains:
- a Dockerfile for the Super Engine;
- a Compose service attached to the external `izakhono-edge` network;
- container hardening settings including a non-root user, dropped Linux capabilities and `no-new-privileges`;
- a workflow requiring a self-hosted runner marked `IZAKHONO_OWNED_RUNTIME=true`;
- artifact digest verification and candidate/acceptance/promotion stages;
- an acceptance script that checks local and public HTTPS health.

These are meaningful deployment controls in source. The owned-runtime contract itself explicitly states that repository files and CI do not prove the existence of the owned node, self-hosted runner, DNS/TLS ingress or release adapter installation.

**No production deployment, runner availability, public route, database migration or live service was independently verified in this repository-source audit.** Runtime state remains unverified.

## 7. Recommended target boundary

Retain the Super Engine as the shared engine/module ecosystem. Define Integration Fabric as a separate product/platform capability that consumes and extends its governed messaging foundations.

Recommended layering:

1. **Integration control plane:** tenants, environments, connector catalogue, versions, credentials references, scopes, approvals, quotas and lifecycle.
2. **Transport-neutral message contract:** tenant/environment, message ID, event type, schema version, source, destination, occurred/received timestamps, correlation ID, causation ID, idempotency key, classification and trace context.
3. **Durable messaging adapter:** PostgreSQL-backed queue initially where justified by measured load and operational fit; preserve an adapter boundary so a future owned broker can be introduced without changing business contracts.
4. **Connector runtime:** separately isolated workers with scoped credentials, egress restrictions, resource limits and connector provenance.
5. **Workflow runtime:** durable state machine, human approvals, retries, compensations and reconciliation.
6. **Policy boundary:** mandatory ID identity and FORTRESS decision at protected ingress, egress and high-impact operation boundaries.
7. **Observability:** append-only audit trail plus operational metrics/traces and delivery receipts.

Do not choose a new broker or incur infrastructure/licensing costs until Phase 0 design and capacity requirements justify it. Do not assume that a PostgreSQL job queue is automatically the best long-term event-streaming technology.

## 8. Prioritised gap register

| Priority | Gap | Required outcome |
|---|---|---|
| P0 | Optional FORTRESS/audit hooks in ServiceBus | Production construction requires explicit policy and audit adapters; fail closed when unavailable |
| P0 | In-memory-only message dispatch | Durable transport contract and persistent delivery lifecycle |
| P0 | No tenant/environment message scope | Tenant isolation enforced from message acceptance through storage, dispatch, logs and replay |
| P0 | No generic idempotency/replay contract | Durable idempotency keys, deduplication and replay controls |
| P0 | Optimistic health semantics | Dependency-aware readiness; health must not equate static metadata with live security enforcement |
| P1 | No schema registry/versioning | Versioned event/connector contracts and compatibility tests |
| P1 | No generic retry/DLQ/backpressure | Bounded retries, poison-message isolation, queue limits and operator recovery |
| P1 | No external connector transport | Isolated connector worker and approved egress model |
| P1 | Missing ServiceBus CI coverage | Explicit core tests included in CI |
| P1 | No end-to-end trace/correlation | Correlation, causation, trace and durable delivery receipts |
| P2 | No Integration Studio/SDK | Governed connector authoring, test and certification experience |
| P2 | No commercial metering | Transparent usage measurements and entitlements |

## 9. Phase 0 decisions and next engineering sequence

**Decision A — Reuse:** Keep `products/izakhono-super-engine` as the existing Super Engine codebase. The current ServiceBus is retained as an in-process module dispatcher until replaced or adapted behind a stable interface.

**Decision B — Do not overclaim:** The current ServiceBus is not the durable enterprise integration backbone. The payment fabric is not a generic connector platform. The Runtime Fabric event store is not a message broker. The Provisioner queue is not a general event bus.

**Decision C — Preserve domain boundaries:** Payment, fulfilment, settlement and refund models remain payment-domain capabilities. Generic integration messages and connector executions receive their own tenant-aware schemas and retention policies.

**Decision D — First technical milestone:** Design and test a versioned, tenant-aware message contract plus durable delivery lifecycle. Establish mandatory ID/FORTRESS and audit adapters before enabling external connector traffic.

**Decision E — Initial proof:** Use a low-risk internal IZAKHONO product-to-product event with synthetic data. Demonstrate durable enqueue, claim/lease, authorised dispatch, idempotent consumer, retry, dead-letter, audit and replay under worker interruption.

### Phase 0 exit status

- Repository inventory: **completed for the reviewed main-branch source tree**.
- ServiceBus source review: **completed**.
- Payment durable patterns reviewed: **completed at source-contract level**.
- Provisioner queue and Runtime event-store patterns reviewed: **completed at source-contract level**.
- Automated test execution in this audit: **not performed**.
- Live runtime/production inspection: **not performed; unverified**.
- Capacity and performance benchmark: **not performed**.
- Security review/penetration testing: **not performed**.

**Conclusion:** There is enough existing code to avoid starting from zero, but not enough to declare a production-grade Integration Fabric. The correct next step is a focused, testable durable-messaging and governance milestone—not a broad rewrite and not premature deployment.
