# Durable Entitlement Persistence Test Matrix V1

| Test | Expected result |
|---|---|
| First webhook reservation | `inserted=true` |
| Same tenant/provider/event repeated | `inserted=false`; no second entitlement mutation |
| Same event ID in different tenant | independent reservation |
| PAID + verified signature | entitlement becomes `ACTIVE` |
| REFUNDED | entitlement becomes `REVOKED` |
| CANCELLED | entitlement becomes `REVOKED` |
| FAILED | entitlement becomes `REVOKED` |
| Unverified webhook | rejected before persistence mutation |
| Concurrent duplicate delivery | one mutation wins; duplicate is a no-op |
| Playback after entitlement revocation | authorization denied |
| Expired entitlement | authorization denied |
| Cross-tenant lookup | no rows returned |
| Audit after state change | exactly one transition record |
| Transaction rollback | webhook and entitlement changes both roll back |
| Retry after transient failure | safe replay without duplicate entitlement |

## Acceptance rule

No production approval until every test is backed by executable evidence against the designated database implementation.

The current repository change supplies the persistence contract and migration; it does not represent evidence that these tests have passed against a production database.
