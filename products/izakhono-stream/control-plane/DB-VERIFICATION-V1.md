# IZAKHONO STREAM — Database Verification Gate V1

## Purpose

This gate defines the executable acceptance boundary for durable entitlement persistence. The migration in this repository is reference infrastructure; these checks must execute against an isolated PostgreSQL/Supabase environment before any production database claim is made.

## Required acceptance tests

1. Migration applies cleanly from an empty database.
2. Re-running the migration is safe/idempotent according to the migration strategy.
3. Tenant isolation prevents cross-tenant entitlement reads and writes.
4. Browser/client roles cannot directly mutate control-plane entitlement tables.
5. A PAID webhook creates exactly one active entitlement for a unique event.
6. A replay of the same provider event is rejected or becomes a no-op without creating a duplicate entitlement.
7. REFUNDED, CANCELLED, and FAILED events revoke or prevent activation according to the contract.
8. Concurrent processing of the same event cannot create duplicate entitlements.
9. Entitlement audit records are append-only.
10. Transaction rollback leaves no partial entitlement or replay-marker state.
11. Rights-window data remains authoritative at playback authorization time.
12. Backup/restore testing demonstrates that entitlement and webhook replay state survive restoration.

## Evidence required for production

- Test run output and commit SHA.
- Database migration version and schema snapshot.
- RLS/policy verification output.
- Concurrency/replay test output.
- Backup and restore evidence.
- Reconciliation evidence.
- Provider sandbox evidence for the selected payment provider.

## Production rule

No production database, live entitlement system, or live payment integration is claimed by this document. The gate remains closed until the tests above are executed against an isolated database and the evidence is retained with the release candidate.
