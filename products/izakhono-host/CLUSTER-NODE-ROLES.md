# IZAKHONO HOST — Logical Node Roles and Execution Fabric

**Architecture boundary:** logical node identities and workload roles are software/orchestration constructs. Physical and virtual execution hosts are separate infrastructure resources.

## Roles

| Logical role | Primary responsibility |
|---|---|
| CONTROL | Provisioner, customer state, jobs, audit and operator control |
| EDGE | Public HTTP/HTTPS ingress and tenant routing |
| DNS | Authoritative and secondary DNS |
| RUNTIME | Customer site execution and static assets |
| DATA | PostgreSQL, MinIO and Valkey |
| MAIL | Owned mail services and acceptance |
| BACKUP | Independent encrypted backup and restore |
| FORTRESS | Secrets, identity, access policy and security telemetry |

A logical node identity may be assigned one or more workload roles. A role may be hosted on one or more execution hosts according to capacity, isolation and failure-domain policy.

## Logical node baseline

The following is a logical role-placement proposal, not a list of existing machines or provisioned resources:

- NODE01: CONTROL + EDGE + RUNTIME
- NODE02: EDGE + RUNTIME + DNS secondary
- NODE03: EDGE + RUNTIME + DNS secondary + BACKUP
- Dedicated DATA, MAIL and FORTRESS logical roles can be added without changing the customer provisioning contract.

No physical or virtual resources are implied by these names. Current execution-host identities, suppliers, locations, capacity and ownership must be inventoried separately. Do not claim a multi-node cluster exists until those resources have been provisioned and independently verified.

## Traffic

Internet → IZAKHONO authoritative DNS → healthy approved execution host carrying the EDGE role → native IZAKHONO HOST runtime → customer site.

Control-plane traffic remains private. Data services are never exposed directly to the public Internet.

## Non-negotiable rules

1. IZAKHONO owns the logical platform and service state.
2. No Vercel, Netlify or other hosted platform is required for production runtime.
3. External providers may exist only as bounded, reversible infrastructure suppliers, adapters, registrars or integrations.
4. Customer state must survive loss of an individual execution host.
5. Site content must be independently recoverable.
6. DNS must have independent secondary capacity.
7. PostgreSQL, object storage and cache services require health and recovery evidence.
8. Backups must be restorable onto another approved execution host.
9. Secrets must never be committed to Git or browser code.
10. The provisioning engine must never declare LIVE without acceptance evidence.

## Execution-host binding

Before a logical node role is activated, its binding record must identify:
- the immutable physical/virtual resource ID and stable hostname;
- the resource owner, supplier/account and IZAKHONO administrative authority;
- location/region and failure domain;
- OS, CPU, RAM, storage and network capacity;
- firewall and public reachability;
- operator/service identity and FORTRESS authorization;
- intended environment and workload roles;
- backup, monitoring, recovery and decommission plans;
- approval and evidence timestamps.

A SentinelX host ID may be recorded as a management reference after an actual execution host is enrolled. It is not a substitute for the infrastructure resource identity and does not itself create or provision compute.

## Production authority

Repository code defines the software. Approved execution hosts provide the runtime capacity. Runtime Fabric/NODE01 governs logical orchestration and workload state; it is not the physical deployment target. Production activation requires a separately approved execution-host binding, preflight, staging validation and production acceptance.
