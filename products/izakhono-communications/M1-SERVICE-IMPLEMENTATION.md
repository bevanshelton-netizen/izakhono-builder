# M1 Service Implementation

## Implemented

- Versioned control-plane API handler under `src/api.ts`.
- Provisioning creation with tenant-scoped idempotency-key protection.
- Provisioning job retrieval and advancement through the repository boundary.
- Deterministic number search through the simulator adapter.
- Stable response envelope with request IDs and machine-readable errors.
- Repository abstraction with a development/test memory implementation.
- Tenant-scoped authorization boundary with OWNER, ADMIN, AGENT and READ_ONLY roles.
- PostgreSQL provisioning repository adapter with parameterized SQL.
- PostgreSQL adapter contract tests using a deterministic fake SQL executor.
- API tests covering authentication, idempotency and cross-tenant isolation.

## Persistence boundary

`ProvisioningRepository` is the persistence seam. `PostgresProvisioningRepository` now provides the native PostgreSQL implementation, while the memory implementation remains development/test-only. The production implementation preserves tenant scoping, idempotency and resumable provisioning semantics without owning database credentials or connection lifecycle.

The M1 SQL schema remains the source migration baseline in `M1-DATA-MODEL.sql`. It has not been claimed as applied to a production database by this commit.

## Boundary

The implementation remains a control-plane service foundation. `SimulatorCarrier` is deliberately side-effect free and does not provide PSTN/SIP connectivity.

## Next gate

Apply and verify the M1 schema on the intended IZAKHONO PostgreSQL runtime, run repository integration tests against that database, wire the PostgreSQL adapter into the service runtime, and then build the first real SIP/carrier adapter with verified inbound/outbound call paths on an owned runtime node.

Production/live status is not claimed by this milestone.
