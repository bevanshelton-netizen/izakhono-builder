# IZAKHONO EDGE — Owned DNS, Edge, Security and Delivery Platform

**Product status: software foundation under construction; public production service is NOT LIVE.**

IZAKHONO EDGE is the first-party alternative to the Cloudflare capabilities IZAKHONO can own and operate: authoritative DNS, DNS lifecycle, reverse-proxy routing, managed TLS, WAF, rate limiting, origin protection, caching, health checks and operational telemetry.

**NODE01 is the software runtime/orchestration identity.** EDGE is built and packaged as a set of NODE01-managed software workloads. NODE01 is not a physical server, VPS or cloud instance. Its execution substrate is a separate concern: software workloads still require approved compute/network capacity to run, but that does not change NODE01's identity.

It is not represented as a global anycast network, registrar, certificate authority or globally distributed DDoS-scrubbing network. Those capabilities require registry/CA/network infrastructure or independently operated points of presence.

## Existing assets discovered in the IZAKHONO repository

The repository already contains substantial components. This project unifies them rather than creating another competing DNS stack.

| Existing component | What is present | What remains |
|---|---|---|
| `infra/authoritative-dns` | PowerDNS primary/secondary compose, API-enabled primary, zone schema, provisioning and cutover verification scripts | NODE01 workload packaging, approved independent execution/network capacity, secrets, delegation and public verification |
| `infra/izakhono-dns` | BIND 9 primary/secondary, FastAPI record controller, TSIG update path | Multi-zone tenant lifecycle and convergence on the selected PowerDNS production authority |
| `products/izakhono-host/src/dns.ts` | Zone/record types, validation, SOA serial and NS helpers | Persistent zone registry and production adapter integration |
| `products/izakhono-host/docker-compose.owned.yml` | Native hosting runtime, Caddy ingress/TLS, CoreDNS baseline, PostgreSQL, MinIO and Valkey | NODE01 workload manifest integration, WAF/cache, approved execution capacity and end-to-end proof |
| `products/izakhono-host/edge/Caddyfile` | HTTPS ingress, hostname routing, on-demand TLS admission | WAF, rate-limit/cache policy, origin restrictions and telemetry |
| `products/izakhono-super-cloud` | Cloud control-plane architecture and workload-plane model | Integration with the canonical NODE01 workload lifecycle and commissioned capacity |

These are repository assets, not evidence of running production services. Prior DNS foundations also exist in project history: Knot DNS and independent ns1/ns2 designs. We will converge on one production authority implementation rather than operate BIND, Knot, PowerDNS and CoreDNS as competing public authorities.

## NODE01 software integration

NODE01 is the canonical software execution/orchestration layer for EDGE. See [NODE01-INTEGRATION-V1.md](./NODE01-INTEGRATION-V1.md).

- EDGE services are versioned, immutable software workloads with explicit manifests, health checks, resource requirements, network scopes and dependency declarations.
- The NODE01 workload lifecycle is responsible for accepting the artifact, verifying its immutable release identity, enforcing FORTRESS/owner approval, scheduling/provisioning it onto an approved execution substrate, checking health and recording evidence.
- The EDGE control plane remains the source of truth for tenant zones, DNS records, routes, policies, jobs and audit. NODE01 manages workload execution; it does not replace EDGE's domain data model.
- DNS primary and secondary are separate workload instances with independent network/failure-domain placement. Merely creating two logical workload names does not prove independence.
- No workload may bypass NODE01's release approval, immutable pin, scoped authorization, audit or rollback controls.
- Do not invent production secrets, approvals, resource bindings or public IPs in source code.

## Product architecture

```text
                IZAKHONO EDGE CONTROL PLANE
        tenants / zones / records / routes / policies
                          |
                approved workload releases
                          |
                  NODE01 SOFTWARE RUNTIME
       manifest / immutable artifact / authorization
       lifecycle / health / audit / rollback evidence
                          |
             approved execution substrates
                 (capacity and networking)
                          |
        +-----------------+------------------+
        |                                    |
   DNS workload cluster                HTTP edge workloads
   PowerDNS primary/secondary          Caddy + WAF + cache
        |                                    |
        +---------------+--------------------+
                        |
                 IZAKHONO HOST origins
                  native site runtime
```

DNS is separate from HTTP edge delivery. Mail protocols must not be proxied through the HTTP edge. SMTP, submission, IMAP and related mail endpoints remain direct service endpoints with their own firewall and TLS policy.

## Cloudflare capability map

| Capability | IZAKHONO implementation | Status |
|---|---|---|
| Authoritative DNS | PowerDNS primary/secondary workloads managed through NODE01 | Source exists; workload integration and public authority not verified |
| DNS management API | EDGE tenant-aware control plane + HOST DNS model | Partial; executable API and persistence integration remain |
| Reverse proxy / ingress | Caddy workload | Present in source; not production-verified |
| TLS automation | Caddy ACME with domain admission | Present in source; production issuance/renewal not verified |
| WAF | ModSecurity + OWASP Core Rule Set | Required implementation; not yet integrated |
| Rate limiting / abuse controls | Per-host/route limits, deny lists and request budgets | Required implementation |
| CDN / caching | Regional edge cache with explicit rules and purge API | Required implementation |
| Origin shielding | Private origin network; only edge reaches web origins | Required implementation |
| DDoS resilience | Host/network filtering, rate limiting and multi-region capacity | Partial; no global scrubbing/anycast equivalent |
| Analytics / telemetry | DNS, HTTP, WAF, health and origin latency | Required integration |
| DNSSEC | Authoritative signing and registrar DS lifecycle | Design/implementation gate; not production enabled |
| Registrar | Registry/registrar remains external | Not an owned registrar |

## Security and operational boundaries

- Authoritative DNS nodes are not recursive resolvers.
- Public DNS requires at least two authoritative servers on independent networks/failure domains.
- TCP/53 and UDP/53 must both be reachable.
- Management APIs remain private and strongly authenticated.
- DNS API keys, TSIG secrets, database passwords, TLS account keys and origin credentials are runtime secrets, never Git content.
- Edge origins accept public HTTP(S) only from approved edge ingress once the topology supports it.
- WAF rules begin in detection mode and move to blocking only after false-positive review.
- Cache defaults are conservative: never cache authenticated, private, transactional, admin, API or personalized responses.
- Mail MX and mail protocol records are published directly, not proxied through HTTP ingress.
- Zone imports preserve MX, TXT, SPF, DKIM, DMARC, CAA, verification and service records.
- A domain is never marked live because a manifest or container merely exists.
- Workload releases require immutable pins and the existing NODE01/FORTRESS approval boundary.

## Production activation gates

A release is not public-live until all relevant evidence is recorded:

1. NODE01 accepts and verifies the exact EDGE workload manifests and immutable artifact references.
2. Workload authorization, FORTRESS scope, owner approval, audit and rollback are verified.
3. Two DNS workload instances are placed on independent approved network/failure domains.
4. Stable public addresses, routing and firewall policy are verified for both DNS endpoints.
5. Direct authoritative UDP and TCP queries pass against both endpoints.
6. Both nodes serve matching SOA serials and NS sets; parent delegation and glue match.
7. DNSSEC validation and DS chain pass before DNSSEC is labelled enabled.
8. EDGE ingress is reachable on TCP/80 and TCP/443.
9. TLS issuance and renewal pass for an approved hostname.
10. WAF, rate limits, cache bypass and purge pass regression tests.
11. Origin isolation is verified externally.
12. Logs, metrics, alerts, backups, restore and rollback pass.
13. Public DNS/registrar changes receive separate explicit owner approval.

## Build sequence

1. Bind EDGE to NODE01's canonical software workload lifecycle.
2. Build the tenant-aware DNS/EDGE control-plane API and persistent job/audit store.
3. Package PowerDNS primary/secondary as versioned NODE01 workloads; retain BIND/Knot as migration/test adapters.
4. Integrate Caddy ingress and managed TLS as an EDGE workload.
5. Add ModSecurity/OWASP CRS, rate limits, safe cache and purge.
6. Add origin isolation, health-aware routing, telemetry, backup and recovery.
7. Validate two independently placed DNS workload instances and their public reachability.
8. Migrate one low-risk domain only after a complete zone parity test and explicit approval.

## Current infrastructure check (26 November 2026)

The connected account inventory previously reported no SentinelX execution hosts or connected infrastructure integrations, and no connected Cloudflare integration. This is not a reason to treat NODE01 as a physical machine or to abandon the software-first build. It means the execution substrate and public network evidence have not yet been bound/verified.

No DNS records, registrar settings, billing or production infrastructure were changed during the inventory.

## Ownership principle

IZAKHONO owns NODE01 and EDGE software, data models, workload definitions, control plane, configuration, customer relationship and operational policy. Compute, IP transit, parent-zone delegation and certificate issuance remain explicit dependencies until independently commissioned and verified.

**Never describe IZAKHONO EDGE as a working Cloudflare replacement until its public DNS and edge endpoints pass production acceptance.**
