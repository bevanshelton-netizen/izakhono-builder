# Tenant Isolation V1

All replay and entitlement identities are tenant-scoped. A payment event for one tenant must never satisfy an entitlement lookup for another tenant. Production persistence must enforce this with database constraints, authorization boundaries, and cross-tenant integration tests.
