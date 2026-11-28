# IZAKHONO EDGE — Owned DNS, Edge, Security and Delivery Platform

**Product status: software foundation under construction; public production service is NOT LIVE.**

IZAKHONO EDGE is the first-party alternative to the Cloudflare capabilities IZAKHONO can own and operate: authoritative DNS, DNS lifecycle, reverse-proxy routing, managed TLS, WAF, rate limiting, origin protection, caching, health checks and operational telemetry.

**NODE01 is software. It is the logical IZAKHONO software-runtime identity and Agent Fabric/orchestration layer—not a physical server, VPS or cloud instance.** Runtime Fabric owns workload scheduling and durable runtime state. HOST is the separately identified execution boundary. The execution environment is not NODE01.

## Existing assets discovered in the IZAKHONO repository

| Existing component | What is present | What remains |
|---|---|---|
| `infra/authoritative-dns` | PowerDNS primary/secondary compose, API-enabled primary, zone schema, provisioning and cutover verification scripts | Runtime Fabric workload binding, independently placed approved execution environments, secrets, delegation and public verification |
| `infra/izakhono-dns` | BIND 9 primary/secondary, FastAPI record controller, TSIG update path | Multi-zone tenant lifecycle and convergence on selected PowerDNS production authority |
| `products/izakhono-host/src/dns.ts` | Zone/record types, validation, SOA serial and NS helpers | Persistent zone registry and production adapter integration |
| `products/izakhono-host/docker-compose.owned.yml` | Native hosting runtime, Caddy ingress/TLS, CoreDNS baseline, PostgreSQL, MinIO and Valkey | Runtime Fabric workload integration, WAF/cache, approved execution capacity and end-to-end proof |
| `products/izakhono-host/edge/Caddyfile` | HTTPS ingress, hostname routing, on-demand TLS admission | WAF, rate-limit/cache policy, origin restrictions and telemetry |
| `products/node01-agent-fabric` | NODE01 v0.3 local task runtime, adapter registry, execution receipts and evidence hashing | Durable production adapters and verified Runtime Fabric/HOST binding |
| `infra/runtime-fabric` | Workload contracts, controller and durable deployment-state foundations | Live EDGE registration, approved runtime binding and production evidence |

These are repository assets, not evidence of running production services. Earlier DNS foundations include BIND, Knot and PowerDNS designs. We will converge on one production authority implementation rather than operate competing public authorities.

## Correct software architecture

- **NODE01 Agent Fabric:** logical software identity, orchestration and task coordination.
- **Runtime Fabric:** workload registry, scheduler, durable deployment state, node selection, failover and lifecycle state.
- **NODE01 command gateway:** authenticated command entry point and adapter boundary.
- **FORTRESS:** identity, scoped workload authorization, approvals, secrets/capabilities and policy.
- **HOST:** separately registered execution environment and service execution boundary.
- **IZAKHONO EDGE:** tenant DNS zones/records, routes, WAF/rate-limit/cache policies, jobs, verification and customer/operator APIs.

EDGE must integrate with these existing components. It must not create a second scheduler or bypass Runtime Fabric, the NODE01 gateway, FORTRESS or HOST.

See [NODE01-INTEGRATION-V1.md](./NODE01-INTEGRATION-V1.md) and the executable workload contract at `infra/runtime-fabric/workloads/izakhono-edge.json`.

## Product architecture

```text
                IZAKHONO EDGE CONTROL PLANE
        tenants / zones / records / routes / policies
                          |
                typed workload declaration
                          |
                 NODE01 AGENT FABRIC
             logical software orchestration
                          |
                 NODE01 COMMAND GATEWAY
              registered adapter / approval
                          |
                     FORTRESS
               authorization + audit
                          |
                  RUNTIME FABRIC
             workload registry / scheduler
              durable state / failover
                          |
                 separately registered
                    HOST execution
                          |
            +-------------+-------------+
            |                           |
       PowerDNS authority          Caddy + WAF + cache
       primary / secondary         HTTP application edge
            |                           |
            +-------------+-------------+
                          |
                  IZAKHONO HOST origins
```

DNS is separate from HTTP edge delivery. Mail protocols must not be proxied through the HTTP edge. SMTP, submission, IMAP and related mail endpoints remain direct service endpoints with their own firewall and TLS policy.

## Cloudflare capability map

| Capability | IZAKHONO implementation | Status |
|---|---|---|
| Authoritative DNS | PowerDNS primary/secondary workloads scheduled by Runtime Fabric | Source exists; workload integration and public authority not verified |
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
- Workload releases require immutable pins and the existing NODE01/FORTRESS/Runtime Fabric approval boundary.

## Production activation gates

A release is not public-live until all relevant evidence is recorded:

1. EDGE workload passes the canonical Runtime Fabric workload contract.
2. NODE01 gateway registration, FORTRESS tenant/workload/environment authorization and correlated audit acknowledgement are fresh and verified.
3. Runtime Fabric selects and binds separately identified, healthy HOST execution environments.
4. DNS primary and secondary have independently evidenced execution environments and network failure domains.
5. Stable public addresses, routing and firewall policy are verified for both DNS endpoints.
6. Direct authoritative UDP and TCP queries pass against both endpoints.
7. Both nodes serve matching SOA serials and NS sets; parent delegation and glue match.
8. DNSSEC validation and DS chain pass before DNSSEC is labelled enabled.
9. EDGE ingress is reachable on TCP/80 and TCP/443.
10. TLS issuance and renewal pass for an approved hostname.
11. WAF, rate limits, cache bypass and purge pass regression tests.
12. Origin isolation, logs, metrics, alerts, backups, restore and rollback pass.
13. Public DNS/registrar changes receive separate explicit owner approval.

## Current build sequence

1. Define EDGE's Runtime Fabric workload and NODE01 gateway profile. **Implemented in this branch.**
2. Add fail-closed registration, FORTRESS authorization/audit and independent DNS placement validation. **Implemented with tests in this branch.**
3. Bind actual live gateway registration and Runtime Fabric/HOST execution adapters. **Not yet available/verified.**
4. Build tenant-aware DNS/EDGE API and persistent job/audit store.
5. Package PowerDNS primary/secondary as Runtime Fabric workloads; retain BIND/Knot as migration/test adapters.
6. Integrate Caddy ingress and managed TLS as an EDGE workload.
7. Add ModSecurity/OWASP CRS, rate limits, safe cache and purge.
8. Add origin isolation, health-aware routing, telemetry, backup and recovery.
9. Validate two independently placed DNS execution environments and their public reachability.
10. Migrate one low-risk domain only after zone parity and explicit approval.

## Current infrastructure check (26 November 2026)

The connected account inventory previously reported no SentinelX execution hosts or connected infrastructure integrations, and no connected Cloudflare integration. This does not make NODE01 physical infrastructure. It means live HOST execution registration and public network evidence have not been bound/verified.

No DNS records, registrar settings, billing or production infrastructure were changed during the inventory or this software-only build.

**Never describe IZAKHONO EDGE as a working Cloudflare replacement until its public DNS and edge endpoints pass production acceptance.**
