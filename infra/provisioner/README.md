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

## Reference implementation

`state-machine.py` is a dependency-free reference engine suitable for unit tests and later embedding behind an API/worker runtime. It intentionally contains no provider credentials and performs no real DNS, hosting, mail or payment calls.

## Promotion rule

`ACCEPTANCE_PASSED` is the first state that can produce a customer handover record. `LIVE` is an operational deployment status outside this reference state machine and requires current public/runtime evidence from the acceptance system.
