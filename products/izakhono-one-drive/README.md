# IZAKHONO ONE DRIVE

**Project ID:** IZK-CLD-001  
**Portfolio:** IZAKHONO CLOUD / SUPER CLOUD  
**Delivery mode:** IZAKHONO-native Builder; credits-free  
**Status:** FOUNDATION COMMITTED — deployment and live storage acceptance pending

## Product decision
IZAKHONO ONE DRIVE is an IZAKHONO-owned personal and business file workspace, not a Microsoft 365 reseller or Hercules dependency.
- Personal and business spaces are separate ownership/security domains.
- Initial logical allowance: 50 GB per personal space and 50 GB per business tenant. Allowances are not pooled.
- Business membership is explicit and role-based.
- Public links and external sharing are disabled by default.
- Object storage uses a replaceable S3-compatible adapter.
- Identity delegates to IZAKHONO CORE / FORTRESS; no second identity store.
- Deployment is owned-first through IZAKHONO SUPER CLOUD / HOST.

## Existing platform reuse
- CORE: identity, tenant context and policy integration. Archived v1.12 storage router still requires integration work before it is considered live.
- SUPER CLOUD: tenant, workload and deployment control plane.
- IZAKHONO DATA: persistent volume contract and replicated storage foundation.
- FORTRESS: authorization, audit and security controls.
- BUILDER: native build and validation path.

## Initial capabilities
Personal/business workspace switcher; folder/file listing and search; upload reservation/completion/download/soft-delete; atomic quota reservations; business roles; version-ready metadata and recycle bin; audit events; provider-neutral object storage.

## Quota model
Default logical entitlement is 50 GiB (53,687,091,200 bytes) per provisioned space. It is not proof that physical capacity is provisioned. Capacity must be independently checked before activation. Quota is enforced through transactional reservations, not read-then-write aggregation.

## Production release gates
CORE/FORTRESS identity integration; migration and RLS isolation tests; concurrent quota tests; object-store upload/checksum/download/delete tests; malware quarantine; backup/restore; node-loss recovery; mobile/desktop E2E; DNS/TLS/monitoring/rollback; independently reachable health-checked endpoint.

## Current delivery boundary
This commit establishes the product contract, relational schema and deterministic domain-policy tests. It does not claim physical capacity, credentials, migration execution, live endpoint or production deployment have been verified.
