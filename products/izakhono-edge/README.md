# IZAKHONO EDGE — Owned DNS, Edge, Security and Delivery Platform

**Product status: source foundation exists; unified platform is under construction; public production service is NOT LIVE.**

IZAKHONO EDGE is the first-party alternative to the parts of Cloudflare that IZAKHONO can responsibly own and operate: authoritative DNS, DNS zone/record lifecycle, reverse-proxy routing, managed TLS, web application firewall, rate limiting, origin protection, caching, health checks, and operational telemetry.

It is not represented as a global anycast network, registrar, certificate authority, or globally distributed DDoS-scrubbing network. Those capabilities require external registry/CA/network infrastructure or significant independently operated points of presence.

## Existing assets discovered in the IZAKHONO repository

The repository already contains substantial components. This project unifies them rather than creating another competing DNS stack.

| Existing component | What is present | What remains |
|---|---|---|
| `infra/authoritative-dns` | PowerDNS primary/secondary compose, API-enabled primary, zone schema, provisioning and public cutover verification scripts | Two real hosts, public IPs, secrets, firewall, registrar delegation and public verification |
| `infra/izakhono-dns` | BIND 9 primary/secondary, FastAPI record controller, TSIG update path, DNS compose | Multi-zone tenant lifecycle, hardened admin gateway, two public failure domains, real delegation |
| `products/izakhono-host/src/dns.ts` | Zone/record types, validation, SOA serial and NS helpers, Allegro migration records | Persistent zone registry and production DNS adapter integration |
| `products/izakhono-host/docker-compose.owned.yml` | Native hosting runtime, Caddy ingress/TLS, CoreDNS baseline, PostgreSQL, MinIO and Valkey | Publicly deployed approved host, separate authoritative secondary, WAF/cache integration and end-to-end proof |
| `products/izakhono-host/edge/Caddyfile` | HTTPS ingress, hostname routing, on-demand TLS admission | WAF, rate-limit policy, cache policy, origin access restrictions, edge telemetry |
| `products/izakhono-super-cloud` | Cloud control-plane architecture and workload-plane model | Commissioned compute/network capacity and live services |

**Important:** these are repository assets, not evidence of running production services. Prior DNS foundations also exist in the project history: Knot DNS and an independent ns1/ns2 design. We must converge on one production authority implementation rather than run BIND, Knot, PowerDNS and CoreDNS as competing public authorities.

## Product architecture

```text
                     DOMAIN REGISTRAR / PARENT ZONE
                                 |
                      delegation + glue + DS
                                 |
                 +---------------+---------------+
                 |                               |
          IZAKHONO NS1                      IZAKHONO NS2
          DNS primary                       DNS secondary
          PowerDNS                          PowerDNS
          Region / network A                Independent region / network B
                 |                               |
                 +---------------+---------------+
                                 |
                      IZAKHONO DNS CONTROL PLANE
               zones / records / serials / audit / approvals
                                 |
                         DNS answers (A/AAAA)
                                 |
                       IZAKHONO EDGE GATEWAY
                    Caddy ingress + WAF + cache
                                 |
                 +---------------+---------------+
                 |               |               |
             Web origins      API origins     Mail services
             HOST runtime     App services    SMTP/IMAP direct
```

DNS is a separate plane from HTTP edge delivery. Mail protocols must not be proxied through the HTTP edge. SMTP, submission, IMAP and other mail ports remain direct service endpoints with their own firewall and TLS policy.

## Cloudflare capability map

| Capability | IZAKHONO implementation | Status |
|---|---|---|
| Authoritative DNS | PowerDNS primary/secondary; BIND remains a development/transition adapter | Built in source; not public-live |
| DNS management API | IZAKHONO HOST zone/record model + DNS adapter | Partial; needs unified tenant API and production integration |
| Reverse proxy / ingress | Caddy | Present in source; not production-verified |
| TLS automation | Caddy ACME with domain admission | Present in source; production certificates not verified |
| WAF | ModSecurity + OWASP Core Rule Set at the HTTP edge | Required implementation; not yet deployed |
| Rate limiting / abuse controls | Per-host and per-route limits, deny lists and request budgets | Required implementation |
| CDN / caching | Regional edge cache with explicit cache rules and purge API | Required implementation |
| Origin shielding | Private origin network; only edge may reach web origins | Required implementation |
| DDoS resilience | Host/network-level filtering, rate limiting, multi-provider/multi-region capacity | Partial; no global scrubbing/anycast equivalent |
| Analytics / telemetry | DNS query, HTTP access, WAF events, health and origin latency | Required integration |
| DNSSEC | Authoritative signing and registrar DS lifecycle | Design gate; not production enabled |
| Registrar | Registry/registrar remains external | Not an owned registrar |

## Security and operational boundaries

- Authoritative DNS nodes are not recursive resolvers.
- Public DNS requires at least two authoritative servers on independent networks.
- TCP/53 and UDP/53 must both be reachable.
- DNS management APIs must never be public without strong authentication and authorization.
- DNS API keys, TSIG secrets, database passwords, TLS account keys and origin credentials are runtime secrets, never Git content.
- Edge origins should accept public HTTP(S) only from IZAKHONO edge ingress once the network topology supports it.
- WAF rules begin in detection mode, are reviewed against application traffic, and only then move to blocking mode.
- Cache defaults are conservative: do not cache authenticated, private, transactional, admin, API or personalized responses.
- Mail MX and mail protocol records are published directly and must not be orange-cloud/proxied through an HTTP reverse proxy.
- Zone imports preserve all existing MX, TXT, SPF, DKIM, DMARC, CAA, verification and service records.
- A domain is never marked live solely because a configuration file or container exists.

## Production activation gates

A platform release is not public-live until all relevant evidence is recorded:

1. Two approved execution hosts exist on separate network/failure domains.
2. Both DNS nodes have stable public addresses and firewall rules.
3. Direct authoritative UDP and TCP queries pass against both nodes.
4. Both nodes serve matching SOA serials and NS sets.
5. Registrar delegation and glue match the intended nameservers.
6. DNSSEC DS/DNSKEY chain validates before DNSSEC is labelled enabled.
7. Edge ingress is reachable on TCP/80 and TCP/443.
8. TLS issuance and renewal are tested for an approved hostname.
9. WAF rules, rate limits and cache bypass rules pass regression tests.
10. Origin isolation is verified from an external network.
11. Logs, metrics, alerting, backups and restore tests pass.
12. Rollback to the previous DNS authority and edge routing is documented and tested.

## Build sequence

1. **Consolidate DNS authority:** choose PowerDNS as the production authority implementation; retain BIND/Knot as tested migration adapters only. Keep one primary and one independent secondary.
2. **Unify DNS lifecycle:** extend IZAKHONO HOST into the tenant-aware source of truth for zones, records, serials, approvals, verification and audit.
3. **Harden the edge:** retain Caddy for TLS/ingress and add a WAF/cache gateway in front of web origins.
4. **Add origin protection:** isolate origin services from direct public access and validate hostname-to-origin admission.
5. **Add security policy:** managed WAF rules, rate limits, bot/abuse controls, allow/deny lists and emergency blocks.
6. **Add cache and purge:** safe cache rules, purge by URL/host/tag and cache telemetry.
7. **Operate multi-region:** deploy NS1/NS2 and edge nodes in independent networks; add health-based routing and failover.
8. **Migrate one low-risk domain:** export its complete DNS zone, validate parity, lower TTLs, change delegation only after approval, and keep rollback ready.

## Current infrastructure check (26 November 2026)

The connected account currently reports:
- no SentinelX execution hosts enrolled;
- no SentinelX integrations connected;
- no connected Cloudflare integration;
- Supabase projects exist, but the projects returned by the account inventory are either unrelated to DNS/hosting or inactive; no active IZAKHONO DNS database was identified.

Therefore no remote server, DNS API, or live zone could be inspected from the management plane in this session. No DNS records, registrar settings, billing, or production infrastructure were changed.

## Ownership principle

IZAKHONO owns the software, data model, control plane, configuration, customer relationship and operational policy. Physical compute, IP transit, domain registry delegation and certificate issuance remain explicit infrastructure dependencies until IZAKHONO has independently commissioned those capabilities.

**Never describe IZAKHONO EDGE as a working Cloudflare replacement until its own public DNS and edge endpoints pass the production acceptance gates.**
