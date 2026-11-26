# IZAKHONO EDGE — Control Plane API v1

## Purpose

Define one tenant-aware API as the source of truth for IZAKHONO-managed zones and edge policies. DNS provider adapters execute approved changes; the API never equates a queued change with a live DNS answer.

The API and DNS/edge services are packaged as NODE01-managed software workloads. NODE01 owns workload release and execution lifecycle; EDGE owns tenant DNS and edge domain data. See `NODE01-INTEGRATION-V1.md`.

## Core resources

### Zone
- `id`: immutable internal identifier
- `tenant_id`: owning tenant
- `fqdn`: normalized fully-qualified zone name
- `authority_profile_id`: selected authoritative cluster
- `status`: `draft | validating | ready | delegated | live | paused | failed`
- `serial`: monotonic SOA serial
- `nameservers`: intended NS set
- `dnssec_status`: `disabled | preparing | signed | ds_published | verified | failed`
- `last_verified_at`: timestamp of independent verification

### DNS record
- `id`, `zone_id`, `name`, `type`, `ttl`, `value`, `priority`, `enabled`
- supported types: A, AAAA, CNAME, MX, TXT, NS, SRV, CAA, PTR, TLSA
- validation is type-aware; MX/SRV priorities and CAA flags/tags are validated separately.
- CNAME coexistence rules, apex restrictions and delegation boundaries are enforced before apply.

### Edge route
- `id`, `tenant_id`, `hostname`, `origin_id`, `enabled`
- `tls_mode`: `managed | customer_certificate | disabled`
- `waf_policy_id`, `rate_limit_policy_id`, `cache_policy_id`
- `origin_access`: `edge_only | private_network | public_transition`
- `health_status`: `unknown | healthy | degraded | unhealthy`

### Security policy
- WAF policy: CRS version, paranoia level, exclusions, mode (`detect | block`), change approval and audit.
- Rate-limit policy: key scope, window, threshold, burst, action, response code.
- Cache policy: eligible methods/statuses, TTL, bypass conditions, purge tags.
- Origin policy: accepted edge source networks, origin authentication and emergency bypass state.

### Change / job
Every mutating operation creates a durable change request:
- actor, tenant, resource, before-state, after-state;
- reason and approval state;
- idempotency key;
- adapter and target cluster;
- execution attempts and result;
- direct authoritative verification evidence;
- rollback snapshot and rollback status.

## API surface

All management endpoints require a scoped service identity, TLS, request-size limits, rate limits and audit logging. Customer and operator roles are separated. Secrets are referenced by secret IDs and never returned.

### Zones
- `GET /v1/zones`
- `POST /v1/zones`
- `GET /v1/zones/{zoneId}`
- `POST /v1/zones/{zoneId}/validate`
- `POST /v1/zones/{zoneId}/changes`
- `POST /v1/zones/{zoneId}/verify`
- `POST /v1/zones/{zoneId}/rollback`

### Records
- `GET /v1/zones/{zoneId}/records`
- `POST /v1/zones/{zoneId}/records`
- `PATCH /v1/zones/{zoneId}/records/{recordId}`
- `DELETE /v1/zones/{zoneId}/records/{recordId}`
- `POST /v1/zones/{zoneId}/records/import`
- `GET /v1/zones/{zoneId}/export`

### Edge routes and policies
- `GET /v1/routes`
- `POST /v1/routes`
- `PATCH /v1/routes/{routeId}`
- `POST /v1/routes/{routeId}/verify`
- `GET /v1/security/waf-policies`
- `POST /v1/security/waf-policies`
- `GET /v1/security/rate-limits`
- `POST /v1/security/rate-limits`
- `GET /v1/cache/policies`
- `POST /v1/cache/purge`

### Operations
- `GET /v1/health`
- `GET /v1/metrics`
- `GET /v1/audit-events`
- `GET /v1/jobs/{jobId}`
- `POST /v1/origins/{originId}/emergency-lockdown`

## Change lifecycle

`draft -> validated -> approval_required -> approved -> queued -> applying -> applied -> independently_verified`

Failure path:
`applying -> failed -> rollback_required -> rolled_back | manual_intervention`

No public DNS write or registrar delegation change is automatic merely because a user created a record. High-impact changes (NS, DS, MX, apex A/AAAA, origin lockout and WAF block-mode changes) require explicit owner approval and a verified rollback plan.

## DNS adapter contract

Adapters implement:
- `inspectZone(zone)`
- `createZone(zone)`
- `readRecords(zone)`
- `applyRecordChange(change)`
- `exportZone(zone)`
- `validateZone(zone)`
- `verifyAuthoritative(zone, nameserver)`
- `setDnssecState(zone, state)`

The production adapter is PowerDNS. BIND and Knot adapters may be used for migration/testing. Cloudflare is an optional import/transition adapter only and is never the IZAKHONO source of truth.

## NODE01 execution contract

EDGE workload execution must use NODE01's current canonical manifest, immutable artifact, release approval and workload lifecycle interfaces. The adapter is not permitted to invent a parallel deployment API or call an execution host directly. Before implementation, map this specification to the actual NODE01 schema and APIs and add contract tests against their canonical fixtures.

NODE01 manages software workload lifecycle. It does not itself supply public IP addresses, network transit, parent-zone delegation or physical compute capacity. These dependencies must be separately provisioned and verified.

## Security invariants

1. Tenant ID is derived from the authenticated identity, never trusted from request JSON.
2. Every record name is proven to be within the selected zone.
3. Secrets are opaque references; no API returns secret material.
4. Every mutation is idempotent and creates an immutable audit event.
5. DNSSEC key operations are isolated from ordinary DNS record administration.
6. No API endpoint exposes arbitrary shell execution.
7. A change cannot be marked verified without querying the actual authoritative nameservers.
8. Customer-facing DNS and edge controls cannot modify platform authority zones.
9. EDGE cannot bypass NODE01/FORTRESS release authorization or immutable artifact pinning.
