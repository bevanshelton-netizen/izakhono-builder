# iKhokha Sandbox Execution Checklist V1

## Environment

- [ ] Isolated test database available
- [ ] iKhokha sandbox merchant/test credentials available through secret storage
- [ ] Webhook endpoint reachable from sandbox
- [ ] Provider webhook verification semantics documented from the provider's current specification
- [ ] Test tenant isolated as `kora-network`

## Execution evidence

- [ ] IKH-001 PAID event verified and persisted
- [ ] IKH-002 replay verified with exactly one entitlement
- [ ] IKH-003 REFUNDED event revokes entitlement
- [ ] IKH-004 CANCELLED event does not grant access
- [ ] IKH-005 FAILED event does not grant access
- [ ] IKH-006 invalid/tampered webhook rejected
- [ ] IKH-007 concurrent duplicate delivery produces one entitlement
- [ ] IKH-008 transaction failure leaves no partial state
- [ ] Playback authorization reflects the durable entitlement state
- [ ] Rights-window enforcement confirmed after entitlement activation
- [ ] Audit entries retained for acceptance run
- [ ] Provider reconciliation completed

## Evidence package

Record for each run:

- execution timestamp
- test/vector ID
- provider event ID
- request/verification result without exposing secrets
- database transaction result
- entitlement before/after state
- audit record reference
- playback authorization result
- repository commit SHA
- failure/retry details where applicable

## Release decision

The gate is `PASS` only when all mandatory vectors have executable evidence. Until then the iKhokha integration remains `REFERENCE_ONLY` and no production payment or entitlement claim may be made.
