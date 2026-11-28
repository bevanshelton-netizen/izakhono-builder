# IZAKHONO EDGE — NODE01 / Runtime Fabric Integration v1

## 1. Non-negotiable identity rule

**NODE01 IS SOFTWARE. NODE01 IS NOT A PHYSICAL OR VIRTUAL HOST.**

NODE01 is the logical software-runtime identity and Agent Fabric/orchestration layer. Runtime Fabric owns workload scheduling and durable deployment state. HOST is the separately identified execution boundary. A VM, server, container host, laptop or runner is never renamed NODE01.

This is the existing IZAKHONO architecture. EDGE must integrate with it rather than introduce a competing scheduler or direct-host deployment path.

## 2. Canonical ownership

| Component | Responsibility |
|---|---|
| NODE01 Agent Fabric | Logical software identity, agent/task orchestration and coordination |
| NODE01 command gateway | Authenticated command entry point; registered execution-adapter boundary |
| Runtime Fabric | Workload registry, scheduling, node selection/failover, durable deployment state and lifecycle |
| FORTRESS | Identity, exact tenant/workload/environment authorization, owner approval, secrets/capabilities and audit |
| HOST | Separately registered execution environment; actual workload execution boundary |
| IZAKHONO EDGE | Tenant zones/records, authority profiles, routes, WAF/rate-limit/cache policies, change jobs and verification |
| IZAKHONO HOST origins | Customer website/application runtime behind EDGE |

Do not duplicate Runtime Fabric's scheduler or deployment-state store in EDGE. EDGE remains the domain source of truth for zones and edge policies; Runtime Fabric remains the workload lifecycle/state owner.

## 3. Existing contract patterns to reuse

The repository already defines:
- `izakhono.runtime-fabric.workload.v1` as the Runtime Fabric workload schema;
- `logical_node_id: NODE01`, `identity_type: software-runtime` and `runtime_host_is_separate: true`;
- node-agnostic placement and verified runtime-registration binding;
- the NODE01 command-gateway adapter registration requirement;
- exact FORTRESS tenant/workload/environment authorization and correlated audit acknowledgement;
- fail-closed behavior when live registration or execution adapters are absent;
- explicit separation between a deployment profile and a verified runtime registration.

The EDGE workload contract is `infra/runtime-fabric/workloads/izakhono-edge.json`. Its NODE01 command-gateway profile is `internal/node01-command-gateway/deploy-profiles/izakhono-edge.json`. The legacy generic `/deploy` path must not be treated as a substitute for the registered Runtime Fabric adapter.

## 4. EDGE workload catalogue

The workload contract describes:
- `edge-control-api`: private tenant-scoped DNS/route/policy lifecycle, durable jobs and audit integration.
- `edge-dns-primary`: PowerDNS primary, private management API and signed update boundary.
- `edge-dns-secondary`: PowerDNS secondary, authenticated transfers only, independent placement.
- `edge-ingress`: Caddy HTTP/HTTPS routing and TLS admission.
- `edge-waf`: ModSecurity + pinned OWASP CRS, initially detection mode.
- `edge-cache`: regional HTTP cache with safe defaults and tenant-aware purge.
- `edge-telemetry`: metrics, logs, DNS/HTTP/WAF events and health aggregation.

The workload is node-agnostic. Runtime Fabric chooses an eligible node and separately registered HOST execution environment. DNS primary/secondary separation is an evidence-backed placement constraint, not a replica count.

## 5. Execution and approval sequence

1. Build/test immutable EDGE artifacts and record source provenance.
2. Validate the workload declaration against the Runtime Fabric v1 schema.
3. Submit through the NODE01 command gateway's registered adapter path.
4. Verify the live adapter registration, stable registration ID, logical NODE01 identity and required capabilities.
5. Verify Runtime Fabric's selected node and the distinct, healthy HOST execution-environment identity.
6. Obtain FORTRESS's explicit allow decision for the exact tenant, `izakhono-edge` workload and `production` environment.
7. Require the correlated FORTRESS audit acknowledgement.
8. Runtime Fabric records deployment state and directs the approved adapter to the selected HOST execution boundary.
9. Verify service readiness and independent DNS/edge behavior; persist evidence and rollback state.
10. Promote or expose public routes only after separate owner approval and acceptance.

The current repository's generic NODE01 gateway `/deploy` handler forwards to CONTROL and is not, by itself, proof of the registered Runtime Fabric adapter, FORTRESS grant or HOST binding. Do not route EDGE around that missing evidence.

## 6. Fail-closed reference implementation

`infra/runtime-fabric/controller/izakhono_edge_activation.py` validates:
- exact Runtime Fabric workload schema/product/environment;
- NODE01 logical software identity and separate HOST execution boundary;
- node-agnostic runtime binding and required gateway capabilities;
- fresh gateway registration (five-minute maximum age);
- healthy, separately identified execution environment;
- exact FORTRESS tenant/workload/environment allow decision;
- matching FORTRESS audit acknowledgement;
- independent execution-environment and network-failure-domain evidence for DNS primary and secondary.

Tests are in `infra/runtime-fabric/controller/test_izakhono_edge_activation.py`. They use synthetic fixtures only. They prove the validator's fail-closed behavior; they do not create or verify a live registration, authorization, execution environment, public IP or running service.

## 7. DNS placement invariants

- Primary and secondary are separate workload instances.
- Runtime Fabric/HOST evidence must identify each execution environment and network failure domain.
- The two failure-domain identifiers must differ.
- A scheduler acknowledgement or two logical names is not proof of independent placement.
- Public acceptance requires externally verified reachability over both UDP/53 and TCP/53.
- SOA serial parity, AA response, recursion disabled, transfer ACLs and parent delegation must be checked.
- If Runtime Fabric cannot prove placement separation, the DNS cluster remains non-production.

## 8. Security invariants

- No credentials, private keys, TSIG values or tokens in manifests, logs or Git.
- All workload artifacts are immutable and pinned.
- FORTRESS authorization is checked at the execution boundary, not trusted from EDGE request JSON.
- Tenant identity is derived from authenticated identity in EDGE.
- Management APIs are private by default.
- DNS zone changes are idempotent, audited and independently verified.
- Rollback is a first-class Runtime Fabric lifecycle action with retained prior state.
- WAF starts in detection mode; cache bypasses all private/personalized responses.
- No arbitrary shell execution over HTTP.

## 9. Remaining implementation gates

- Bind the validator to the real Runtime Fabric registry and NODE01 gateway adapter.
- Confirm FORTRESS's production EDGE authorization policy and audit persistence path.
- Confirm the actual Runtime Fabric schema validator and execution adapter accept this workload.
- Bind a durable EDGE tenant DNS/route/policy API to the approved persistence owner.
- Add disposable integration tests against the real interfaces; synthetic callbacks are not production integration.
- Complete public DNS, edge, TLS, WAF/cache, origin and backup/restore acceptance.

## 10. Explicit non-claims

This integration contract does not claim a live gateway registration, FORTRESS production grant, Runtime Fabric scheduler binding, HOST execution environment, public DNS endpoint or live EDGE service. NODE01 is the software identity; the separate execution boundary must be independently evidenced.
