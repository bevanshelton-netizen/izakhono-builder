# IZAKHONO EDGE — NODE01 Software Integration v1

## 1. Binding architecture rule

**NODE01 IS SOFTWARE. NODE01 IS NOT PHYSICAL INFRASTRUCTURE.**

NODE01 is the IZAKHONO-owned logical software runtime and workload orchestration identity. Execution hosts, VMs, containers and approved compute environments are substrates on which NODE01-managed workloads may run. They are not NODE01 itself.

IZAKHONO EDGE must integrate with NODE01's existing software workload/release lifecycle. It must not introduce a competing host orchestrator, bypass NODE01 approval gates, or describe an execution host as NODE01.

## 2. Responsibility boundaries

| System | Owns |
|---|---|
| NODE01 | Workload identity, manifest/release verification, immutable artifact pin, approval enforcement, execution lifecycle, placement request, health evidence, rollback orchestration and workload audit |
| IZAKHONO EDGE | Tenant zones, records, DNS authority profiles, routes, WAF/rate-limit/cache policies, change requests, DNS verification and customer/operator APIs |
| IZAKHONO HOST | Customer site runtime and origin services |
| FORTRESS | Principal identity, scoped authorization, owner approvals, secrets/capabilities and policy |
| Execution substrate | CPU, RAM, storage, network interfaces, public IP reachability and failure-domain characteristics |

Do not duplicate tenant DNS state inside NODE01. Do not store arbitrary shell commands in EDGE manifests. NODE01 receives typed workload declarations and immutable artifacts.

## 3. EDGE workload catalogue

The initial workload family is:

- `edge-control-api`: private API, tenant-scoped DNS/route/policy lifecycle, durable jobs and audit integration.
- `edge-dns-primary`: PowerDNS primary, private management API, zone storage and signed update boundary.
- `edge-dns-secondary`: PowerDNS secondary, authenticated transfer only, independent placement.
- `edge-ingress`: Caddy HTTP/HTTPS routing and TLS admission.
- `edge-waf`: ModSecurity + pinned OWASP CRS, initially detection mode.
- `edge-cache`: regional HTTP cache with safe defaults and tenant-aware purge.
- `edge-telemetry`: metrics, logs, DNS/HTTP/WAF events and health aggregation.

Workloads may be co-located for development and isolated for production. DNS primary/secondary independence is a placement constraint, not merely a replica count.

## 4. Manifest contract

Every NODE01 workload declaration must specify:

- stable workload ID and version;
- product and service ownership (`izakhono-edge`);
- immutable OCI artifact digest or immutable source release SHA;
- exact repository and commit provenance;
- environment and deployment scope;
- typed configuration schema and secret references (never secret values);
- CPU/memory/storage requirements and health/readiness probes;
- ports and private/public network intent;
- placement constraints and required failure-domain separation;
- dependencies and startup/readiness ordering;
- backup/restore and rollback policy;
- FORTRESS capability and owner-approval references.

The actual NODE01 manifest schema is authoritative. This document is a product integration contract, not permission to invent or bypass schema fields. Before implementation, map each field to the current NODE01 schema and reject unsupported fields rather than silently dropping them.

## 5. Release and lifecycle

1. Build and test the EDGE workload artifact in CI.
2. Produce immutable artifact digest and source provenance.
3. Submit the typed manifest and exact release reference to NODE01.
4. NODE01 validates manifest, repository, commit, environment, workload and action scope.
5. FORTRESS/owner approval is verified using the existing signed approval/capability path.
6. NODE01 schedules the workload onto approved execution capacity according to placement constraints.
7. Workload starts with least-privilege secrets and private network defaults.
8. Readiness and functional checks run; DNS verification queries the actual authoritative endpoints.
9. NODE01 records release, health, audit and rollback evidence.
10. Promotion/public exposure remains separately approved.

No CI job, application endpoint or customer user may bypass NODE01 to execute arbitrary deployment commands.

## 6. DNS placement invariants

- Primary and secondary are separate workload instances.
- Production secondary must be on a distinct network/failure domain from primary.
- A scheduler acknowledgement is not proof of independent placement.
- Public DNS acceptance requires externally verified public reachability over both UDP/53 and TCP/53.
- SOA serial parity, AA response, recursion disabled, transfer ACLs and parent delegation must be checked.
- If NODE01 cannot prove placement separation, the DNS cluster remains non-production.

## 7. Security invariants

- No credentials, private keys, TSIG values or tokens in manifests, logs or Git.
- All workload artifacts are immutable and pinned.
- All deployment approvals are exact-scope, time-bounded and replay-resistant.
- NODE01/FORTRESS authorization is checked at the execution boundary, not trusted from EDGE request JSON.
- Tenant identity is derived from authenticated identity in EDGE.
- Management APIs are private by default.
- DNS zone changes are idempotent, audited and independently verified.
- Rollback is a first-class lifecycle action with retained prior state.
- WAF starts in detection mode; cache bypasses all private/personalized responses.

## 8. Implementation gates

Before writing the NODE01 adapter, inspect the current canonical NODE01 workload manifest schema, command gateway API, release approval verifier and FORTRESS capability contract. Reuse their exact contracts; do not infer endpoint paths, token formats, labels or runtime semantics from historical documentation.

Before production promotion, require the NODE01 and EDGE CI suites, disposable integration tests, artifact provenance, signed approval tests, backup/restore, failure simulation and the production acceptance checklist.

## 9. Explicit non-claims

This integration contract does not claim NODE01 is currently deployed on a public host, that a workload scheduler has capacity, that two public DNS nodes exist, or that EDGE is public-live. Software identity and execution substrate are separate facts.
