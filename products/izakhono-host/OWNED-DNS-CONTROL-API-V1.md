# IZAKHONO HOST — Owned DNS Control API v1

## Status

Implemented as an owner-authenticated control-plane API over the existing IZAKHONO HOST D1 database and the existing `dns_zones`, `dns_records`, and `dns_audit_events` schema from migration `0003_dns_authority.sql`. This is a control-plane capability only. It does not publish records to public authoritative nameservers.

## Authentication and tenant boundary

All routes are behind the existing `HOST_ADMIN_SECRET` owner authentication in `src/index.ts`. Every zone and record operation requires a `customer_id`; zone lookups use both `zone_id` and `customer_id`. This is an operator API with explicit tenant scoping, not a customer-facing self-service credential model.

## Routes

- `GET /api/dns/zones?customer_id=<id>` — list only that customer's zones.
- `POST /api/dns/zones` — create a planned zone. JSON: `customer_id`, `zone_name`, `primary_nameserver`, `secondary_nameserver`.
- `GET /api/dns/zones/<zone_id>/records?customer_id=<id>` — list records for a customer's zone.
- `POST /api/dns/zones/<zone_id>/records` — add a record. JSON: `customer_id`, `name`, `type`, `value`, optional `ttl`, optional `priority`.
- `DELETE /api/dns/zones/<zone_id>/records/<record_id>?customer_id=<id>` — delete one record.

Supported writable record types: A, AAAA, CNAME, MX, TXT, SRV, CAA. SOA and NS remain controlled by the zone authority configuration. TTL is bounded to 30–86400 seconds; MX priority is validated; CNAME exclusivity is enforced by both API preflight checks and SQLite triggers in migration `0004_dns_cname_exclusivity.sql`, including concurrent writes. Zone creation and record create/delete operations use D1 transactional batches so desired-state changes, serial increments and audit events commit or roll back together. The HOST CI suite runs SQLite contract tests for the CNAME invariant.

## Publication safety

Responses explicitly report `publication: not-published`. Mutations persist desired state only. They do not call Cloudflare, Vercel, PowerDNS, BIND, Knot, a registrar, or any public DNS endpoint. No worker currently consumes these desired-state changes. The next implementation step is an authenticated Runtime Fabric / NODE01 adapter that turns validated zone state into a durable, FORTRESS-authorized deployment job and publishes only after dual-authority acceptance checks.

## Production gates

A zone remains `planned` until two independent authoritative execution environments and network failure domains are registered, UDP/TCP 53 are externally reachable, SOA serial parity and authoritative answers are verified, DNSSEC and delegation acceptance are completed, and FORTRESS approval/audit evidence is present.
