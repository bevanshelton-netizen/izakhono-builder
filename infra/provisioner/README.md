# IZAKHONO PROVISIONER v1

The provider-independent orchestration layer for customer onboarding.

## Purpose

Convert a paid customer order into an evidence-gated, repeatable provisioning job without bespoke infrastructure instructions.

Pipeline:

`PAYMENT_VERIFIED → TENANT_CREATED → DOMAIN_READY → DNS_READY → SITE_READY → TLS_READY → MAIL_READY → INTEGRATIONS_READY → ACCEPTANCE_PASSED → HANDOVER_READY`

The Provisioner owns workflow state, idempotency, retries, audit events, adapter selection and promotion rules. Providers are adapters only.

## Executable registry

`adapters/registry.yaml` is the routing source of truth. `registry-loader.py` validates the registry before it can drive execution. `capability-contracts.v1.yaml` defines the desired-state fields and independent acceptance checks for each capability.

Selection order is strictly:

1. owned adapter
2. explicitly approved external adapter
3. unavailable → block

External adapters cannot silently replace an owned capability, and provider names do not become part of the customer workflow contract.

## Design rules

- **Owned-first:** the default adapter target is IZAKHONO infrastructure.
- **Provider-neutral:** DNS, registrar, edge, hosting, mail, CRM, WhatsApp and payment implementations are replaceable adapters.
- **Fail closed:** an uncertain or failed gate cannot advance the job.
- **Idempotent:** every command has an idempotency key; repeating it must not create a second tenant, site, mailbox or payment link.
- **Evidence-gated:** deployment success alone never means LIVE.
- **Retryable:** transient adapter failures are retryable with bounded attempts and backoff.
- **Auditable:** state transitions and adapter outcomes are append-only events.
- **Compensatable:** failed later stages expose explicit rollback/reconciliation hooks rather than destructive automatic guesses.
- **Secret-safe:** credentials and tokens never enter job state, manifests, logs or handover records.

## Acceptance

`acceptance-engine.py` independently checks every required completed stage. Adapter success alone never establishes customer handover; missing or failed evidence blocks certification.

## Durable submission and execution receipts

The PostgreSQL-backed service binds each tenant-scoped idempotency key to a SHA-256 digest of the canonical request body. An exact replay returns the original job; reusing the key with a different request is rejected with `IDEMPOTENCY_CONFLICT`. Replays also reassert the unique queue row, repairing a process interruption after job persistence but before queue insertion.

The durable queue leases work with `FOR UPDATE SKIP LOCKED`. A verified intermediate step is re-queued for the next state-machine stage; a terminal job is removed from the runnable queue. Lease loss remains an explicit error rather than silently acknowledging work.

When a job reaches `HANDOVER_READY` or `BLOCKED`, the worker records a terminal receipt containing the outcome, job/tenant identity, completion time, attempt count, evidence-state list and SHA-256 evidence digest. Receipt identity is deterministic and replay-safe. PostgreSQL commits the terminal job state, append-only receipt event and FORTRESS audit mirror through the same connection transaction. The receipt is exposed in the job's evidence/status record.

The current implementation reuses the existing JSONB evidence and audit tables; it introduces no schema migration. Production database ownership, migration authority and transaction behaviour still require owner confirmation and authorized integration testing before activation.

## Reference implementation

`state-machine.py` is a dependency-free reference engine suitable for unit tests and later embedding behind an API/worker runtime. It intentionally contains no provider credentials and performs no real DNS, hosting, mail or payment calls.

## Promotion rule

`ACCEPTANCE_PASSED` is the first state that can produce a customer handover record. `LIVE` is an operational deployment status outside this reference state machine and requires current public/runtime evidence from the acceptance system.
