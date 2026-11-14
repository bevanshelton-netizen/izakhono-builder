# IZAKHONO HOST — Sovereign Compute Fabric v1

**Canonical product:** IZAKHONO HOST  
**Project ID:** IZK-HOST-001  
**Portfolio classification:** IZAKHONO AFRICA / Shared Digital Infrastructure  
**Document status:** Architecture baseline — implementation and production activation remain evidence-gated  
**Logical software identity:** NODE01 (software only; never a machine or host)

## 1. Mission

Build the highest-capability practical compute platform for IZAKHONO while keeping the software, orchestration, data model, deployment process and recovery procedures under IZAKHONO control.

The platform must scale beyond one machine, use replaceable execution environments, and avoid purchasing or maintaining physical hardware where virtual compute is sufficient.

**Principle:** own the software and control plane; rent or allocate only the compute capacity actually required; preserve the ability to migrate.

This is not a claim that physical compute disappears. CPUs, memory, storage and network capacity remain necessary. The design makes those resources replaceable infrastructure rather than permanent product dependencies.

## 2. Architecture invariants

1. NODE01 is the stable logical identity of IZAKHONO software. It is not a VM, host, server, IP address, container or hardware identity.
2. Every execution environment has its own immutable infrastructure ID and separately verified runtime binding.
3. No single execution environment is a production single point of failure.
4. The control plane, application runtime, data services and public edge are separate trust and failure domains.
5. All services are containerised or reproducibly provisioned from version-controlled configuration.
6. All durable state is backed up independently of the compute node that runs it.
7. Secrets are generated and stored outside source control; access is least-privilege and auditable.
8. Production promotion requires automated tests, health evidence, security checks, backup/restore evidence and external reachability checks.
9. Provider adapters are replaceable. No provider-specific API is allowed to become the system's source of truth.
10. No capacity is purchased or provisioned without an explicit owner-approved cost ceiling.

## 3. Logical planes

### A. Control plane
Owns desired state, identities, project registry, node inventory, provisioning plans, release orchestration, policy decisions, job scheduling and audit history. It issues signed, bounded tasks; it does not expose arbitrary shell execution to applications or users.

### B. Compute plane
A pool of replaceable execution environments. Workloads are scheduled by workload class, resource limits, trust boundary and availability requirements. Scale horizontally by adding/removing workers; scale vertically only where workload evidence justifies it.

### C. Edge plane
Redundant ingress and routing, TLS termination, request filtering, rate limiting and health-aware traffic distribution. Public ingress is restricted to explicitly approved services. Administrative and data-plane ports remain private.

### D. Data plane
PostgreSQL for transactional state; S3-compatible object storage for artifacts and files; Valkey-compatible cache/ephemeral coordination; durable queues for asynchronous work. Each durable store has independent backup, retention and restore testing.

### E. Agent and build plane
Isolated workers for code generation, builds, tests, browser automation, data processing and specialist agents. Each job receives a scoped identity, explicit inputs, resource/time limits, an isolated workspace and a verifiable output artifact. Jobs are idempotent where possible and have bounded retries and dead-letter handling.

### F. Security plane (FORTRESS)
Central identity and policy, secrets management, signed workload identity, audit events, vulnerability scanning, image provenance, dependency controls, network segmentation, intrusion telemetry and incident recovery. Fail closed for privileged operations.

### G. Observability plane
Centralised logs, metrics, traces, service health, queue depth, saturation, error budgets, deployment events and cost/capacity telemetry. Alerts must identify an owner, severity, evidence and recovery action.

## 4. Workload classes

| Class | Examples | Scheduling policy |
|---|---|---|
| Interactive | Private workspace, APIs, dashboards | Low latency, reserved baseline capacity |
| Agent | Specialist agents, orchestration | Queue-based, bounded concurrency |
| Build | App and website builds, package creation | Ephemeral isolated workers |
| Test | Unit, integration, browser and security tests | Parallel workers with evidence retention |
| Data | PostgreSQL, object storage, search/index | Stateful placement, replication and tested recovery |
| GPU/accelerated | Model inference, embeddings, media processing | Optional accelerator pool; provision only on measured demand |
| Batch | Imports, reports, bulk processing | Elastic, interruptible where safe |

Do not reserve expensive GPU capacity continuously until real workload measurements prove it is economical. Support a pluggable local or remote inference adapter without coupling the platform to one model vendor.

## 5. Reference node-role topology

The existing IZAKHONO HOST role model remains authoritative and is extended by workload pools:

- CONTROL: control plane and policy orchestration.
- EDGE: redundant public ingress.
- DNS: authoritative and secondary DNS on independent failure domains.
- RUNTIME: application and customer workloads.
- DATA: transactional database and object storage.
- WORKER: agent, build, test and batch execution.
- MAIL: isolated mail services where deliverability and operational requirements are met.
- BACKUP: independent encrypted backup and restore target.
- FORTRESS: identity, secrets and security services.

Roles may be co-located in a small development footprint. Production placement must separate critical trust and failure domains as capacity permits. A logical role is not a promise that a dedicated physical machine already exists.

## 6. Reliability and recovery

- Keep at least two independent edge paths before claiming edge high availability.
- Run secondary DNS independently before changing authoritative delegation.
- Use PostgreSQL point-in-time recovery where supported and regularly test restoration to a clean environment.
- Replicate object data across independent failure domains when the selected storage substrate supports it.
- Maintain encrypted, versioned backups outside the primary compute environment.
- Test restore procedures on a schedule; a successful backup job alone is not recovery evidence.
- Use rolling deployments, health-gated promotion and automatic rollback to the last known-good release.
- Use queue leases, idempotency keys, bounded retries and dead-letter queues for durable jobs.
- Define and measure service-level objectives before claiming production resilience.

Initial target objectives (to be validated against actual capacity and budget):
- Control/API availability target: 99.9% monthly.
- Recovery point objective for critical transactional state: 15 minutes or better.
- Recovery time objective for critical control services: 4 hours or better.
- Critical alerts: acknowledged within 15 minutes during staffed operating windows.
These are engineering targets, not current measured guarantees.

## 7. Security baseline

- Private-by-default control plane; no open registration.
- Strong owner authentication and optional hardware-backed MFA.
- Separate human, service, worker and tenant identities.
- Least-privilege, short-lived credentials and secret rotation.
- No secrets, private keys, tokens or customer data in Git history.
- Private networking for databases, caches, queues and internal APIs.
- Signed release artifacts and pinned container image digests for production.
- Dependency, container, static-analysis and secret scanning in CI.
- Immutable audit records for privileged actions, policy changes and production releases.
- Rate limits, request-size limits, resource quotas and abuse controls.
- Documented incident response, key revocation and disaster recovery.

## 8. Software delivery and portability

- Infrastructure definitions are version-controlled and provider-neutral where practical.
- OCI containers are the portable runtime unit.
- Persistent data formats and export paths are documented.
- A provider adapter must support provisioning, health, inventory and teardown without owning canonical project or customer state.
- Environment configuration is declarative; secrets are injected at runtime.
- Every release is traceable to source commit, build, test evidence, image digest and deployment record.
- GitHub may be used as a source mirror, but the IZAKHONO internal repository remains the canonical source of truth as designed.

## 9. Capacity strategy

Use progressive capacity profiles rather than guessing a large fixed server:

1. **Development:** one modest virtual execution environment; local tests and isolated containers.
2. **Private production foundation:** separate control/data/edge trust boundaries, with redundant edge and independent backup.
3. **Scale-out:** add stateless runtime and worker capacity based on CPU, memory, queue latency and request metrics.
4. **Accelerated compute:** add temporary GPU capacity only for measured AI workloads.
5. **Multi-region:** introduce only when latency, recovery or customer demand justifies the operational complexity.

The scheduler must enforce CPU, memory, disk, network and concurrency limits. Autoscaling must have maximum ceilings and owner-visible spend controls.

## 10. Delivery gates

### Gate 0 — Audit
Inventory the existing HOST implementation, scripts, images, ports, secrets, tests, node inventory, domains and runtime bindings. Identify gaps before changing production.

### Gate 1 — Reproducible build
Build and validate the complete stack in an isolated test environment. Validate configuration, container health, migration, security scanning and smoke tests.

### Gate 2 — Secure private activation
Activate only on an owner-approved execution environment. Confirm private control-plane access, secret handling, firewall rules, monitoring and backup.

### Gate 3 — Recovery proof
Restore database, object data, runtime state and configuration onto a clean replacement environment. Record measured RPO/RTO.

### Gate 4 — Scale and failure tests
Exercise node loss, worker crash, queue backlog, storage pressure, network interruption and rolling release. Verify bounded recovery and no silent data loss.

### Gate 5 — Production acceptance
Verify DNS, TLS, public routes, mobile/desktop access, end-to-end user flows, security posture, backups and owner acceptance. Only then mark services LIVE.

## 11. Current verified baseline and limitations

Repository documentation and source inspection establish that IZAKHONO HOST already contains:
- a native Node.js control-plane runtime;
- a Docker Compose baseline including Caddy, CoreDNS, PostgreSQL, MinIO and Valkey;
- a multi-role cluster model;
- node preflight and compliance scripts;
- bootstrap, backup and restore scripts;
- a native runtime health endpoint and smoke-test entry point.

This source inspection does **not** establish that any live execution environment is currently provisioned, that public DNS/TLS is working, that the stack passes current tests, or that backup restoration and multi-node failover have been proven.

Before production activation, audit and test the current Compose definitions and scripts. In particular, verify persistent data coverage for every stateful service, secure MinIO/Valkey exposure, database migration/restore procedures, DNS zone correctness, Caddy admission, container image pinning, host firewall policy and the separation of public and administrative APIs.

The existing repository is publicly visible. Do not place credentials, private operational topology, customer information or sensitive incident details in it. Review whether repository visibility should be changed through an explicit owner-approved action.

## 12. Definition of done

The Sovereign Compute Fabric is complete only when:
- the existing HOST code is audited and the architecture is implemented without duplicating existing products;
- all critical services build reproducibly and pass automated tests;
- private authentication and least-privilege policies are verified;
- at least one clean replacement environment can be provisioned from code;
- durable data is restored successfully from independent backups;
- worker and runtime capacity can scale within explicit ceilings;
- a failed node does not destroy canonical project state;
- end-to-end tests pass from Samsung Android and Windows/browser clients;
- all production status claims are backed by current machine-readable evidence;
- the owner has approved the operating budget and production activation.

**Status:** Architecture baseline only. No live server, production cluster, public endpoint, high availability or disaster-recovery capability is claimed until the corresponding gates pass.
