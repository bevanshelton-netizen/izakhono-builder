# M1 Service Implementation

## Implemented

- Versioned control-plane API handler under `src/api.ts`.
- Provisioning creation with tenant-scoped idempotency-key protection.
- Provisioning job retrieval and advancement through the repository boundary.
- Deterministic number search through the simulator adapter.
- Stable response envelope with request IDs and machine-readable errors.
- Repository abstraction with a development/test memory implementation.
- Tenant-scoped authorization boundary with OWNER, ADMIN, AGENT and READ_ONLY roles.
- API tests covering authentication, idempotency and cross-tenant isolation.

## Persistence boundary

`ProvisioningRepository` is now the persistence seam. The memory implementation is intentionally development/test-only. The production implementation must be backed by IZAKHONO-owned PostgreSQL and preserve tenant scoping, idempotency and resumable provisioning semantics.

## Boundary

The implementation remains a control-plane service foundation. `SimulatorCarrier` is deliberately side-effect free and does not provide PSTN/SIP connectivity.

## Next gate

Implement the PostgreSQL repository adapter and apply the M1 schema on the intended IZAKHONO PostgreSQL runtime. Then add repository integration tests, followed by a real SIP/carrier adapter and verified inbound/outbound call paths on an owned runtime node.

Production/live status is not claimed by this milestone.
