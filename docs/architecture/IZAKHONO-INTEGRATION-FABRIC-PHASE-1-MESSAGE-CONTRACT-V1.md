# IZAKHONO INTEGRATION FABRIC — PHASE 1 MESSAGE CONTRACT V1

**Status:** Proposed engineering contract; design artifact only  
**Version:** 1.0  
**Date:** 26 November 2026  
**Parent architecture:** `architecture/IZAKHONO-INTEGRATION-FABRIC-ARCHITECTURE-V1.md`  
**Scope:** Tenant-aware internal event/message envelope, authority boundary, delivery lifecycle and acceptance criteria

> This contract does not assert that a durable broker, worker, schema registry or production integration runtime exists. It defines the first implementation target and the rules that implementation must satisfy.

## 1. Phase 1 objective

Establish one transport-neutral message envelope and governed delivery lifecycle that can be implemented first with a repository-local adapter and later backed by an approved durable store/queue without changing product event contracts.

Phase 1 must not:
- replace or misrepresent the existing in-memory Super Engine ServiceBus;
- introduce a second Super Engine;
- treat a physical/virtual host as NODE01 (NODE01 is a logical software/runtime identity);
- permit external connector traffic before mandatory ID/FORTRESS and audit enforcement;
- assume exactly-once effects across independent systems;
- create public endpoints, provision infrastructure, incur costs or activate production.

## 2. Contract vocabulary

- **Message:** immutable business/event data plus metadata describing its identity, scope and contract.
- **Delivery:** one attemptable dispatch of a message to a named consumer/subscription.
- **Producer:** authorised product or service that creates a message.
- **Consumer:** registered handler that receives a delivery.
- **Tenant:** the authoritative IZAKHONO entity/customer boundary. It is not supplied as trusted context by an untrusted payload.
- **Environment:** explicitly configured deployment scope (for example, development, test or production); never inferred from a hostname.
- **Message ID:** globally unique identifier for one immutable message.
- **Idempotency key:** stable key for deduplicating a business operation; scoped to tenant, producer and operation.
- **Correlation ID:** identifier linking related work across a business process.
- **Causation ID:** identifier of the message or command that directly caused this message.
- **Delivery ID:** unique identifier for a message-to-consumer delivery record.
- **Policy decision:** FORTRESS decision evaluated for the exact action, subject, tenant/entity, resource and permission.

## 3. Canonical envelope

The initial contract uses JSON-compatible values and RFC 3339 UTC timestamps. The envelope is versioned independently from the payload schema.

### 3.1 Required fields

| Field | Type | Rule |
|---|---|---|
| `specversion` | string | Exact value `1.0` for this envelope revision |
| `id` | string | Unique immutable message ID |
| `type` | string | Namespaced event type, e.g. `izakhono.experience.case.created` |
| `source` | string | Registered producer URI/identifier; validated against registry |
| `subject` | string | Producer-defined resource identifier, no secrets |
| `time` | string | RFC 3339 timestamp with timezone; normalise to UTC |
| `tenant` | object | Trusted tenant/entity identifier and environment |
| `datacontenttype` | string | `application/json` initially |
| `dataschema` | string | Immutable/versioned schema identifier |
| `trace` | object | Correlation and optional causation identifiers |
| `data` | object | Payload validated against `dataschema` |

### 3.2 Optional fields

| Field | Type | Rule |
|---|---|---|
| `partitionkey` | string | Opaque ordering key; no global ordering guarantee |
| `expiry` | string | RFC 3339 expiry; expired messages are not dispatched |
| `classification` | string | Approved data classification label |
| `extensions` | object | Namespaced, registered extension fields only |

### 3.3 Illustrative envelope

This is a contract example, not a live event or a secret-bearing payload.

```json
{
  "specversion": "1.0",
  "id": "msg_01JEXAMPLE0000000000000000",
  "type": "izakhono.experience.case.created",
  "source": "izakhono://experience/api",
  "subject": "case/case_example_01",
  "time": "2026-11-26T05:00:00Z",
  "tenant": {
    "entity_id": "ent_example",
    "environment": "test"
  },
  "datacontenttype": "application/json",
  "dataschema": "urn:izakhono:schema:experience.case.created:1.0.0",
  "trace": {
    "correlation_id": "cor_example_01",
    "causation_id": null
  },
  "classification": "internal",
  "data": {
    "case_id": "case_example_01",
    "case_type": "feedback_followup",
    "created_at": "2026-11-26T05:00:00Z"
  }
}
```

Example identifiers are synthetic. Implementations must obtain tenant/entity identity from trusted ID-authenticated context and the registered producer configuration, not accept arbitrary tenant claims from client-supplied JSON.

## 4. Validation and immutability

At enqueue/publish time, the implementation must:
1. authenticate the producer through IZAKHONO ID or an approved service identity;
2. derive the trusted tenant/entity and environment from authenticated context and server-side registration;
3. resolve the producer and event type in the registry;
4. verify that the producer is allowed to emit this event type for this tenant/environment;
5. validate envelope and payload against the declared schema version;
6. reject unknown required fields, malformed identifiers, invalid timestamps and unsupported content types;
7. enforce payload byte limits and data-classification rules;
8. reject secrets, credentials and prohibited personal/financial fields from logs and metadata;
9. assign or validate message ID and idempotency key according to the API contract;
10. persist the accepted message and initial delivery state atomically before returning an accepted result.

After acceptance, envelope and payload are immutable. Corrections create a new message with a new ID and a causation link. Mutable delivery state belongs to the delivery record, not the message envelope.

## 5. Tenant and environment isolation

The tenant scope is a mandatory composite boundary for:
- producer registration and event permissions;
- schema and connector configuration where tenant-specific;
- message storage and delivery records;
- idempotency/deduplication keys;
- consumer registration and claims;
- retry/dead-letter/replay;
- audit and operational queries;
- retention, deletion and usage metering.

Every persistence query and state transition must include tenant/entity and environment scope. A message cannot be moved across tenants by editing a payload or replay request. Cross-tenant integration requires a separately authorised, explicit transfer workflow with data-owner approval and auditable purpose.

## 6. Permission catalogue — proposed exact permissions

Permissions are candidates for owner-reviewed FORTRESS policy. This document does not grant them. No wildcard, implicit role inheritance or “admin means everything” semantics.

| Permission | Intended operation |
|---|---|
| `integration.message.publish` | Publish a registered event type |
| `integration.message.read` | Read authorised message metadata/payload |
| `integration.delivery.consume` | Claim and process deliveries for a registered consumer |
| `integration.delivery.ack` | Acknowledge a successful delivery |
| `integration.delivery.retry` | Schedule an authorised retry |
| `integration.delivery.deadletter` | Move a delivery to dead-letter state |
| `integration.delivery.replay` | Request replay under explicit replay policy |
| `integration.registry.read` | Read connector/event/consumer registry metadata |
| `integration.registry.write` | Register or change integration metadata |
| `integration.audit.read` | Read permitted audit records |
| `integration.operation.approve` | Approve a specifically bound high-impact operation |

Every FORTRESS check must include authenticated subject, tenant/entity, product, exact permission, target resource/event/consumer, environment, action parameters or their canonical digest, and request context. A decision must be bound to the operation being performed and have an expiry. If ID, FORTRESS or audit is unavailable, the protected operation fails closed.

The internal test implementation may use injected test doubles, but production constructors must not silently default to permissive/no-op policy or audit adapters.

## 7. Delivery state machine

A delivery is one message routed to one registered consumer.

Allowed states:

- `pending` — durable record accepted, not yet claimed;
- `leased` — worker has a time-bounded claim;
- `succeeded` — consumer completed and acknowledgement persisted;
- `retry_scheduled` — transient failure with next-attempt time;
- `dead_lettered` — non-retryable failure or retry budget exhausted;
- `cancelled` — explicitly cancelled by authorised policy/operator before completion;
- `expired` — message expired before successful processing.

Permitted transitions:

```text
pending -> leased
retry_scheduled -> leased
leased -> succeeded
leased -> retry_scheduled
leased -> dead_lettered
pending|retry_scheduled -> cancelled
pending|retry_scheduled -> expired
leased -> retry_scheduled   (lease expired / worker interrupted)
```

Terminal states are succeeded, dead_lettered, cancelled and expired. A dead-letter replay creates a new delivery attempt/history entry linked to the original delivery; it does not erase the failure record. State transitions must be compare-and-set/transactional and audited.

## 8. Lease, retry and acknowledgement semantics

- A worker claims work atomically and receives a lease token plus lease expiry.
- Only the current lease holder may acknowledge or change the leased delivery.
- A lease expiry makes the delivery eligible for re-claim; it does not imply the consumer had no side effect.
- A consumer must be idempotent using a tenant-scoped inbox/operation key or equivalent domain constraint.
- Acknowledgement is accepted only after the consumer's durable effect has committed.
- Retry policy is bounded, uses exponential backoff with jitter, and records attempt count and next-attempt time.
- Retryable and non-retryable errors are classified explicitly; authentication/authorisation failures and schema violations are not blindly retried.
- On timeout after an external write, reconcile/query the destination before retrying consequential operations.
- Delivery guarantees are at-least-once. Exactly-once external effects are not promised.
- Ordering is only per declared partition key and only if the selected adapter can demonstrate it.

Initial defaults for tests only (not production tuning): max attempts 5; lease duration 30 seconds; backoff schedule capped at 15 minutes; payload maximum 256 KiB. These values must be configuration, validated and reviewed before production use.

## 9. Durable persistence boundary

The first persistence interface must be transport-neutral and expose the smallest useful operations:

- `enqueue(message, delivery_targets)`
- `claim(tenant, environment, consumer, lease_duration)`
- `ack(delivery_id, lease_token)`
- `fail(delivery_id, lease_token, error_class, retry_policy)`
- `expire_leases(now)`
- `dead_letter(delivery_id, lease_token, reason)`
- `replay(dead_letter_id, approved_request)`
- `get_delivery(delivery_id, authorised_scope)`

The adapter must support atomic message + initial delivery creation, atomic claim/lease, conditional acknowledgement, durable retry scheduling and auditable terminal state. The first implementation should prefer existing repository persistence patterns only after review; payment-specific tables must not be repurposed as generic integration storage.

No database or queue provider is selected by this contract. Selection requires an explicit operational comparison: ownership, durability, concurrency, backup/restore, migration, cost, observability, security and execution-substrate compatibility.

## 10. Audit record minimum

For publish, claim, acknowledge, retry, dead-letter, replay, cancel and policy denial, record:
- event/action name and timestamp;
- trusted actor/subject and tenant/entity;
- environment;
- message and delivery IDs;
- producer, consumer and event type;
- attempt number and state transition;
- FORTRESS decision reference and policy version;
- correlation/causation identifiers;
- result/error classification;
- payload digest, not raw sensitive payload;
- approval reference where required.

Audit failure must prevent acceptance or completion of protected operations unless a formally approved durable audit buffer exists. No silent best-effort audit in production.

## 11. First proof of capability

Use a synthetic, low-risk internal IZAKHONO event with no external connector and no personal or financial data.

The proof must demonstrate:
1. authorised publish creates durable message + delivery;
2. invalid schema is rejected before acceptance;
3. tenant A cannot read, claim, acknowledge or replay tenant B's delivery;
4. two workers cannot hold the same active lease;
5. worker interruption causes lease expiry and safe re-claim;
6. duplicate message delivery does not duplicate the consumer's domain effect;
7. transient failure schedules bounded retry;
8. retry exhaustion reaches dead-letter with complete history;
9. replay requires exact permission and preserves original history;
10. policy denial and audit failure fail closed;
11. expired messages are not dispatched;
12. health/readiness reports actual policy, audit and persistence dependencies, not static module metadata.

## 12. Acceptance criteria and evidence

Phase 1 is complete only when:
- envelope and payload schema validation are implemented and versioned;
- trusted tenant/environment binding is enforced at the API/service boundary;
- exact permission checks are mandatory and tested;
- durable adapter meets the atomicity and lease contract;
- delivery state transitions are enforced and audited;
- idempotency/inbox behaviour is tested;
- failure-injection tests cover worker interruption, duplicate delivery, lease races, retry and dead-letter;
- tenant isolation tests cover every read/write/claim/replay path;
- test commands are included in CI and actually pass;
- documentation distinguishes tests, repository evidence, preview deployment and production readiness.

A successful typecheck or static build alone is not evidence of durability, security certification or production readiness.

## 13. Implementation sequence

1. Add typed envelope and validation module with schema fixtures.
2. Add explicit producer/consumer registration and trusted tenant context interface.
3. Define policy/audit adapter interfaces with fail-closed production construction.
4. Implement persistence interface and transactional durable adapter selected after review.
5. Implement delivery state machine, lease and idempotent consumer inbox.
6. Add failure-injection and tenant-isolation tests.
7. Integrate one internal synthetic event.
8. Update CI to execute all new tests.
9. Conduct code/security review before any external connector or production activation.

**Out of scope for this phase:** external connector execution, public webhook ingress, customer Integration Studio, commercial metering, production infrastructure provisioning, public DNS/routing changes, paid services and autonomous high-impact operations.
