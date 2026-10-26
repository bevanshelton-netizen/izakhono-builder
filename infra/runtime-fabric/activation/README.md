# Runtime Fabric Activation Gates

A node can be provisioned and a release can be deployed without public traffic being enabled.

`LIVE_VERIFIED` requires all eight evidence gates:

1. immutable release verified
2. runtime node healthy
3. release deployment verified
4. EDGE routing verified
5. TLS verified
6. DNS verified
7. application smoke test verified
8. rollback path verified

If any gate is missing, the decision is `BLOCKED` and public routing remains prohibited.

This prevents the common failure mode where infrastructure success is incorrectly reported as application launch.
