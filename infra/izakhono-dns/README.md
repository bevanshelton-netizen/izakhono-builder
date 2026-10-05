# IZAKHONO DNS

Owned-first authoritative DNS control plane for IZAKHONO infrastructure.

## What this solves

- Central DNS record management for IZAKHONO-owned domains.
- BIND 9 authoritative primary/secondary architecture.
- API-driven record creation and deletion.
- Safe zone validation before reload.
- DNSSEC-ready BIND configuration.
- Separation of authoritative DNS from recursive DNS.
- Portable Docker deployment so the control plane can move from Vercel/cloud to IZAKHONO-owned nodes.

BIND supports authoritative primary and secondary servers, with secondaries synchronizing by AXFR/IXFR. Production DNS should use at least two authoritative servers on separate networks. DNSSEC can sign authoritative zones and provide integrity/authenticity validation. See the BIND documentation for the authoritative and DNSSEC models.

## Architecture

```text
                 IZAKHONO DNS CONTROL PLANE
                         HTTPS API
                             |
                  +----------+----------+
                  |                     |
             DNS Admin UI          Provisioner
                  |                     |
                  +----------+----------+
                             |
                       DNS Controller
                             |
                       BIND PRIMARY
                       udp/tcp :53
                             |
                       AXFR / IXFR
                             |
                 +-----------+-----------+
                 |                       |
          BIND SECONDARY #1       BIND SECONDARY #2
          separate network        separate network

Registrar delegation:
ns1.izakhonoafrica.co.za
ns2.izakhonoafrica.co.za
ns3.izakhonoafrica.co.za
```

## Important Internet requirement

The software does not bypass domain-registry delegation. For a public domain such as `izakhonoafrica.co.za`, the parent registry/registrar must delegate the domain to our authoritative nameservers. Once delegated, IZAKHONO DNS can be the authoritative system for the zone.

## Development

```bash
cd infra/izakhono-dns
docker compose up --build
```

The API is intentionally minimal in this first foundation release. Production hardening must include:

- HTTPS/mTLS or an authenticated gateway
- RBAC
- audit logging
- encrypted TSIG/rndc credentials
- separate primary/secondary hosts
- firewalling of TCP/UDP 53
- monitoring and DNS query telemetry
- automated backups
- DNSSEC key protection
- rate limiting

## First production target

Use this controller to make `nav.izakhonoafrica.co.za`, `api.nav.izakhonoafrica.co.za`, and other IZAKHONO services resolvable from the public Internet without making Cloudflare the authoritative DNS dependency.
