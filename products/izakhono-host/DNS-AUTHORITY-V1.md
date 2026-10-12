# IZAKHONO DNS Authority v1

## Objective

Make DNS an IZAKHONO-owned infrastructure capability rather than a Vercel/Cloudflare dependency.

## Separation of concerns

- **Control plane:** IZAKHONO HOST owns customers, zones, records, serials, audit history and provisioning state.
- **Authoritative plane:** dedicated DNS nodes answer UDP/TCP 53 for delegated zones.
- **Adapters:** Cloudflare, Vercel and other DNS providers are reversible transition/fallback adapters.
- **Registrar:** remains external until IZAKHONO has a registrar integration; registrar delegation is the final authority for which nameservers answer publicly.

## Required production topology

At minimum:

- `ns1.<owned-authority-domain>` in one network/region;
- `ns2.<owned-authority-domain>` in a materially independent network/region;
- UDP **and** TCP port 53 exposed publicly;
- DNSSEC signing planned before broad customer migration;
- monitoring from multiple external resolvers;
- automated serial increments and record validation;
- zone backups and immutable audit events.

Do **not** use a web/serverless function as the authoritative DNS server. HTTP hosting and authoritative DNS are different protocols and failure domains.

## Migration policy

1. Create the zone in IZAKHONO HOST.
2. Import the current provider records without deleting unknown records.
3. Validate SOA/NS and all customer-critical records.
4. Bring both authoritative nodes online.
5. Verify direct queries against both nodes.
6. Lower TTLs before delegation changes.
7. Change registrar nameserver delegation.
8. Verify from independent public resolvers.
9. Keep the previous provider as read-only fallback during the stabilization window.
10. Only then migrate the next production domain.

## Allegro first migration

The currently known Vercel web routing is represented by the migration helper in `src/dns.ts`:

- apex A: `216.198.79.1`
- `www` CNAME: `07c410584da92c16.vercel-dns-017.com.`

These are transition records, not the final owned-hosting architecture.

## Status rule

A domain is **not** marked `live` merely because a zone exists in the control plane. It becomes `live` only after authoritative queries, registrar delegation and application/TLS checks all have evidence.
