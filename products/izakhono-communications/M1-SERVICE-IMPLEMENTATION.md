# M1 Service Implementation

## Implemented

- Versioned control-plane API handler under `src/api.ts`.
- Provisioning creation with idempotency-key protection.
- Provisioning job retrieval.
- Resumable provisioning advancement through the existing carrier abstraction.
- Deterministic number search through the simulator adapter.
- Stable response envelope with request IDs and machine-readable errors.
- API-level idempotency test.

## Boundary

The implementation is a control-plane service foundation. `SimulatorCarrier` is deliberately side-effect free and does not provide PSTN/SIP connectivity.

## Next gate

Replace the in-memory job store with the IZAKHONO PostgreSQL persistence adapter, add tenant/RBAC authorization middleware, then connect a real SIP/carrier adapter and verify inbound/outbound call paths on an owned runtime node.

Production/live status is not claimed by this milestone.
