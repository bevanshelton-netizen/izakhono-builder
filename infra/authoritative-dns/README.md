# IZAKHONO Authoritative DNS

This is the owned-first authoritative DNS plane for IZAKHONO infrastructure.

## Architecture

```text
Internet
  |
  +--> Parent registry (.com/.org/etc.)
          |
          +--> ns1.<zone>  ---> IZAKHONO DNS PRIMARY
          |
          +--> ns2.<zone>  ---> IZAKHONO DNS SECONDARY

Authoritative DNS
  |
  +--> A / AAAA / CNAME / MX / TXT / SRV / CAA / NS
  +--> DNSSEC signing
  +--> AXFR/IXFR replication
  +--> API-controlled provisioning
  +--> Health checks and serial monitoring

Web routing remains separate:
DNS -> public IP -> router/NAT -> NODE01 -> Caddy -> application
```

## Components

- PowerDNS Authoritative Server
- PostgreSQL-backed zone store
- REST API for controlled provisioning
- Primary/secondary replication using AXFR/IXFR
- DNSSEC capability
- Health/readiness checks
- No dependency on Vercel or Cloudflare for authoritative DNS
- Mail remains isolated from the web plane

## Important production rule

Creating the DNS service is only one half of sovereignty. The domain's registrar/registry delegation must point to the deployed authoritative nameservers. For in-bailiwick nameservers, the registrar must publish the required glue records.

For `allegrovibez.com`, the intended production nameservers are configured through environment variables rather than hard-coded until the actual public IPs are verified.

## Required production inputs

Set these in the deployment environment; never commit them:

- `PRIMARY_NS_FQDN`
- `SECONDARY_NS_FQDN`
- `PRIMARY_PUBLIC_IPV4`
- `SECONDARY_PUBLIC_IPV4`
- `PDNS_API_KEY`
- `PDNS_DB_PASSWORD`
- `AXFR_ALLOWED_NETS`

## Deployment gates

A DNS server is NOT considered authoritative/live until all are true:

1. Two authoritative servers exist.
2. They have globally routable, distinct network locations.
3. UDP/53 and TCP/53 are reachable from the Internet.
4. Both return authoritative SOA/NS answers for the zone.
5. Zone contents and SOA serials are consistent.
6. Parent delegation matches the authoritative NS set.
7. Glue records are correct when nameservers are in-bailiwick.
8. DNSSEC is enabled only after DS/DNSKEY validation is verified end-to-end.
9. Web records resolve to the intended owned edge.
10. Existing MX/TXT records are preserved before any cutover.

These gates follow the baseline requirements for authoritative name servers: at least two servers, distinct networks, UDP/TCP reachability, authoritative answers, and consistency between delegation and served data.

## ALLEGRO cutover

Do not overwrite the existing ALLEGRO DNS zone blindly. First export the current zone and preserve all web, mail, verification, SPF, DKIM, DMARC and other TXT/MX records. Then import the records into the IZAKHONO zone and validate the new authority before changing registrar delegation.

The final cutover is a registrar operation. The infrastructure here prepares the authoritative service; it cannot change registrar delegation without access to the registrar account.
