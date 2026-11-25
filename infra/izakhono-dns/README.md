# IZAKHONO DNS

Owned-first authoritative DNS control plane for IZAKHONO infrastructure.

## First-party domain

The first-party IZAKHONO mail and hosting domain is **`izakhono.africa`**. The BIND primary and secondary configurations serve it as a distinct zone.

The older `izakhonoafrica.co.za` zone is retained as a separate legacy portfolio zone. It is not an alias for `izakhono.africa`, and records must never be copied between the zones without an explicit domain-owner decision.

## What this solves

- Central DNS record management for IZAKHONO-owned domains.
- BIND 9 authoritative primary/secondary architecture.
- API-driven record creation and deletion.
- Safe zone validation before reload.
- DNSSEC-ready BIND configuration.
- Separation of authoritative DNS from recursive DNS.
- Portable Docker deployment so the control plane can move from CI/development to approved IZAKHONO execution infrastructure.

BIND supports authoritative primary and secondary servers, with secondaries synchronizing by AXFR/IXFR. Production DNS should use at least two authoritative servers on separate networks. DNSSEC can sign authoritative zones and provide integrity/authenticity validation.

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

Intended first-party delegation (only after public IPs and glue are verified):
ns1.izakhono.africa
ns2.izakhono.africa
```

## Important Internet requirement

This repository contains configuration and zone templates only. It does not establish registrar ownership, create public servers, allocate public IP addresses, or change parent-registry delegation.

For `izakhono.africa`, the registrar must publish the approved authoritative nameservers and the correct glue records because the nameservers are in-bailiwick. Do not delegate to the example addresses in the zone file: `192.0.2.0/24` is documentation-only space. Replace those placeholders only after two real authoritative servers exist on distinct networks and pass the full public DNS acceptance tests.

The legacy `izakhonoafrica.co.za` zone remains separate and unchanged.

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

## First-party mail and hosting records

The `izakhono.africa` zone starts with nameserver authority records only. Do not add MX, SPF, DKIM, DMARC, A/AAAA or service records from guesses. Stalwart must generate the exact mail records after runtime bootstrap; public service addresses must come from the approved execution-host binding. Publish records only after owner review and an approved DNS change plan.

## Current state

- Zone template and primary/secondary configuration: present in source.
- Public authoritative servers: not provisioned or verified.
- Public registrar delegation/glue: not changed or verified.
- Public mail/web records: not published by this repository change.
- Runtime, DNSSEC and external resolution: not production-verified.
