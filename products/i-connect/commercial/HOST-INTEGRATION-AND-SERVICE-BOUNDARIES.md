# I-CONNECT ↔ IZAKHONO Infrastructure / HOST Integration

**Status:** Target architecture and implementation contract  
**Purpose:** Reuse IZAKHONO-owned infrastructure without bypassing HOST, Runtime Fabric, FORTRESS or existing deployment gates.

## 1. Architectural decision

I-CONNECT is a tenant-aware business application and service orchestration layer. IZAKHONO HOST is the owned-first hosting/runtime substrate. I-CONNECT must not implement competing host provisioning, DNS, TLS, node registration, secrets storage or infrastructure command execution.

Integration is through authenticated, versioned service APIs and typed jobs. No browser request may directly execute infrastructure commands.

## 2. Responsibilities and systems of record

| Capability | System of record |
|---|---|
| Customer organisation, service catalogue and connectivity order | I-CONNECT |
| Hosting customer, domain, site and deployment state | IZAKHONO HOST control plane |
| Logical software identity and runtime placement | Runtime Fabric / existing node registry |
| Typed infrastructure provisioning and retries | PROVISIONER / HOST job workflow |
| Identity, policy, device trust, audit and secrets governance | FORTRESS |
| Application source/build artifact | BUILDER and internal repository layer |
| Payments and merchant ledger | I-PAY/payment integration, only after its release gates |
| Provider wholesale service and network fulfilment | Contracted external provider or separately authorised owned network |

Do not duplicate a canonical record in another database merely for convenience. Use references and event projections with provenance.

## 3. Service lifecycle contract

I-CONNECT lifecycle:
DRAFT → QUOTED → ORDERED → PAYMENT_PENDING (if applicable) → ACCEPTED → PROVISIONING → ACTIVE → SUSPENDED → TERMINATED.

HOST lifecycle and deployment states remain governed by HOST's own status vocabulary and acceptance rules. I-CONNECT must not map a requested/queued HOST job directly to ACTIVE.

Rules:
- ACTIVE requires authoritative service-owner evidence.
- A hosting entitlement is not a live website.
- A domain record is not proof of DNS delegation.
- A TLS certificate is not proof of correct application content.
- A connectivity quote is not an order.
- A provider order acknowledgement is not a live network service.
- A payment intent is not a settled payment.
- A CI pass is not production deployment evidence.

## 4. Proposed integration operations

Implement only after inspecting existing HOST and PROVISIONER API contracts to avoid duplicate endpoints.

- Create an authorised typed service request with tenant, product, approved quote, idempotency key and correlation ID.
- Read request state and authoritative HOST job reference.
- Read service state and evidence summary.
- Cancel only when underlying lifecycle permits.
- Receive signed HOST/PROVISIONER events; verify signature, timestamp, replay window and event ID.
- Reconcile I-CONNECT projection with HOST authoritative state and flag divergence; never silently overwrite the source of truth.

These are proposed integration shapes, not claims that the routes currently exist. Reuse existing APIs if equivalent contracts already exist.

## 5. Security and tenant isolation

- Derive tenant from verified FORTRESS membership; never trust client-supplied organisation IDs as authorization.
- Use service-to-service identity with narrow scopes, rotation and revocation.
- Enforce environment isolation (development, staging, production) and product-specific service permissions.
- Never expose host credentials, shell access, node secrets, database credentials or internal topology to customer clients.
- Audit actor, tenant, environment, requested action, approval, idempotency key, source event, result and evidence reference.
- Privileged provisioning and destructive operations require owner/operator authorization and policy checks.
- Keep PII minimal; store provider and KYC references rather than raw identity secrets wherever possible.

## 6. Reliability and consistency

- Use transactional outbox/inbox patterns for cross-system events.
- Scope idempotency to tenant + environment + operation + key.
- Persist business state and audit evidence atomically within each system of record.
- Treat unknown upstream outcomes as reconciliation-required, not failed or successful.
- Use bounded retries with immutable attempt records and an exception queue.
- Use optimistic concurrency or version checks for state transitions.
- Do not assume distributed transactions across HOST, I-CONNECT, I-PAY and external carriers.
- Support compensation actions where cancellation is possible; never pretend a partially fulfilled external service was rolled back.

## 7. Infrastructure deployment boundary

This integration does not authorize physical host execution, DNS changes, node bootstrap, production secret configuration or customer service activation. Those actions require the existing verified, authorised HOST execution interface, runtime registration, FORTRESS approval and current acceptance evidence. NODE01 is a logical software identity, not a physical machine.

## 8. Operational observability

Each cross-system request carries request ID, correlation ID, tenant ID, environment, I-CONNECT order/service reference, HOST job/site reference, provider reference, idempotency scope and key hash, lifecycle state/version, last trusted event and timestamp, evidence references, exception classification and assigned owner.

Dashboards separate software subscription health, HOST service health and upstream carrier health. Never combine them into a single misleading availability number.

## 9. Acceptance criteria

- Unauthorized tenant cannot read or mutate another tenant's services.
- Client cannot choose environment or privileged provider account.
- Duplicate requests with same scoped idempotency key create one logical operation.
- Different tenants or environments may safely reuse the same raw key without collision.
- Out-of-order and replayed events are rejected or reconciled safely.
- I-CONNECT never marks service ACTIVE without source-of-truth evidence.
- HOST failure does not corrupt I-CONNECT billing or customer identity.
- Provider outage is visible and does not cause false activation.
- Audit record and business state commit atomically within each system boundary.
- Restore/replay tests demonstrate no duplicate charge or provisioning action.
