# IZAKHONO MAIL Runtime Fabric Integration Contract v1

**Status:** Documentation-only architecture contract; proposed, not activated  
**Related work:** GitHub issue #743; DEPLOY control-plane PR #724  
**Runtime policy:** NODE identities are logical software runtimes. They are not physical hosts.

## 1. Purpose and non-goals

This contract defines the boundary between the existing NODE01 Command Gateway, authenticated CONTROL handoff, Runtime Fabric, FORTRESS and the execution adapter required to operate IZAKHONO MAIL.

It is a design baseline for implementation and review. It does not authorize provisioning, deployment, database changes, migrations, credential access, runner registration, DNS changes, outbound mail or production traffic.

The contract must not turn a mocked gateway request, repository declaration, CI result or planned node into evidence of runtime execution.

## 2. Workload decomposition — do not confuse the API with the mail platform

The existing profile references `products/izakhono-mail/Dockerfile.node`. That is an application/API workload boundary. It is not, by itself, proof that the owned mail transport and webmail stack is deployed.

Model at least these separately versioned workload components:

| Component | Repository boundary | Responsibility | Persistence class |
|---|---|---|---|
| Mail application/API | `products/izakhono-mail` | Product API, control and application endpoints | Explicitly declared application data only |
| Mail transport | `products/izakhono-host/mail` (Stalwart) | SMTP, submission, IMAP and mailbox transport | Durable mail and queue data |
| Webmail | `products/izakhono-mail/runtime-v1` (Roundcube runtime) | User webmail interface | Configuration/session data; mailbox content remains owned by mail transport |
| Edge | Approved IZAKHONO EDGE integration | Public HTTPS and mail protocol routing | No application source of truth |

The final decomposition, dependencies, ports, storage classes and release coupling must be confirmed against the actual Compose/service definitions before implementation. Do not silently promote the API container as the whole mail-hosting product.

A component may be independently released only where its compatibility contract and rollback behavior are explicit. A coordinated release must pin every component artifact digest.

## 3. Control-plane flow

The intended request path is:

`Owner/client → NODE01 Command Gateway → authenticated CONTROL → Runtime Fabric → registered MAIL adapter → authorized HOST execution environment`

Responsibilities:

- **Command Gateway:** authenticate the caller, validate the command/profile, enforce immutable release pinning and forward a bounded deployment request. It is not the deployment executor.
- **CONTROL:** authenticate the gateway handoff, establish tenant and environment scope, validate policy and FORTRESS authorization, and submit an idempotent deployment request.
- **Runtime Fabric:** own durable job lifecycle, scheduling, health/readiness, recovery and failover decisions. It selects a logical runtime target separately from its underlying execution environment.
- **MAIL adapter:** implement the versioned MAIL workload lifecycle using typed operations. It must not reuse or relabel the KORA-specific activation script.
- **HOST execution interface:** perform only the authorized typed operation on a registered, attested execution environment. No arbitrary shell command or inferred host locator is part of this contract.
- **FORTRESS:** govern authorization, protected secret references/injection and immutable actor-attributed audit evidence.

A successful response from one boundary is not proof that the next boundary ran. Each handoff must carry a correlation/deployment ID and produce a verifiable receipt.

## 4. Versioned workload descriptor

The MAIL workload descriptor should be schema-versioned and include, at minimum:

- `api_version`: fixed contract identifier, initially `izakhono.runtime-workload/v1`;
- `workload_id`: stable product/component identifier, independent of node and host;
- `tenant_id` and `environment`: explicit scope, never inferred from a hostname;
- `release`: repository identity, approved immutable commit, artifact digest, build provenance and component compatibility set;
- `runtime`: logical node policy and required adapter capability;
- `health`: internal readiness path, expected status/body contract, timeout and dependency checks;
- `storage`: named persistent volumes, ownership, backup/restore policy and schema compatibility;
- `network`: private service dependencies and explicitly approved ingress/egress protocols;
- `secrets`: FORTRESS secret references only; never secret values;
- `resources`: bounded CPU, memory and storage requirements;
- `lifecycle`: deploy, inspect, stop, replace, backup, restore and rollback capability declarations;
- `acceptance`: machine-verifiable checks and evidence requirements.

The descriptor must reject unknown or unsupported contract versions. It must not include a physical host address, SSH target, raw credentials or arbitrary command string.

## 5. Immutable release and approval rules

Production profiles must require an owner-approved immutable release reference. Missing approval must fail closed.

- A syntactically valid Git SHA is not automatically an approved release.
- Resolve the approved source revision to immutable built artifact digest(s); record both.
- Pin each component in a coordinated release. Never use a mutable tag as the production identity.
- Verify provenance and policy before dispatch.
- A retry with the same idempotency key and identical request returns the recorded result; reuse with a different request digest is a conflict.
- A rollback is a new audited lifecycle operation referencing the exact prior approved release and the state/data compatibility plan.

Until the product release approver and approval source are confirmed, the MAIL production profile remains blocked. Do not invent an `approved_ref` or populate one with an arbitrary commit.

## 6. Authorization, tenant scope and audit

Before dispatch, CONTROL must verify:

1. authenticated actor and calling service identity;
2. FORTRESS authorization for the requested operation;
3. tenant, application and environment scope;
4. approved release identity and deployment policy;
5. registered workload adapter capability;
6. registered runtime and authorized execution environment;
7. idempotency key and request digest.

The durable audit record must include actor/service identity, tenant, application, environment, operation, release digest, logical node, execution-environment attestation reference, authorization decision, timestamps, correlation ID, result and evidence references.

Deployment state, idempotency claim/result and immutable audit/outbox record must be committed under the approved authoritative transaction boundary. The existing independently committing stores must not be described as atomic. If the authoritative state store and audit destination are separate, the owner must explicitly approve the transactional-outbox topology and reconciliation policy.

## 7. Lifecycle and failure semantics

The implementation must define and test these states:

`RECEIVED → AUTHORIZED → QUEUED → SCHEDULED → EXECUTING → VERIFYING → ACCEPTED`

Terminal or recovery states include `REJECTED`, `BLOCKED`, `FAILED`, `ROLLED_BACK` and `CANCELLED`.

Requirements:

- transitions are validated and durably recorded;
- retries are bounded and idempotent;
- a lost worker lease cannot create duplicate side effects;
- failed readiness cannot be promoted to accepted;
- recovery resumes from the last verified state;
- rollback records the exact prior release and outcome;
- health checks verify release identity, not merely an open port;
- logical NODE identity and physical execution-environment identity remain separate;
- no unverified or unhealthy runtime receives public traffic.

## 8. Mail-specific acceptance

Technical readiness, external mail acceptance and LIVE status are separate decisions.

### Internal technical checks

- API readiness and dependency checks;
- Stalwart service readiness and durable mailbox/queue storage;
- Roundcube readiness and authenticated integration with the intended mail services;
- private backplane boundaries and approved edge exposure;
- release identity and configuration compatibility;
- persistence across restart;
- backup and isolated restore;
- controlled upgrade and rollback;
- monitoring, logs and audit correlation.

### External production acceptance

Independent evidence is required for:

- approved DNS and TLS configuration;
- MX and SMTP reachability;
- submission and IMAP behavior;
- SPF, DKIM and DMARC alignment;
- external send, receive and reply tests;
- queue retry/bounce behavior;
- mailbox persistence and restore;
- abuse controls, rate limits and outbound-send authorization;
- rollback and incident response.

No DNS/MX/SPF/DKIM/DMARC change, outbound sending enablement, customer migration or production traffic cutover is authorized by this document.

## 9. Required integration tests

Before any execution certification, test at least:

- authorized and unauthorized actor;
- missing/unapproved release pin;
- artifact digest/provenance mismatch;
- wrong tenant or environment;
- unknown contract version;
- missing or incompatible MAIL adapter;
- unregistered/unhealthy runtime;
- missing or invalid execution attestation;
- request replay and idempotency conflict;
- concurrent idempotency claims;
- worker crash/lease expiry and recovery;
- adapter execution failure and rollback;
- readiness failure and dependency outage;
- state + idempotency + audit atomic rollback on a real disposable PostgreSQL service;
- cross-component MAIL release compatibility;
- no public ingress or DNS change before separate acceptance approval.

Mock tests may validate individual boundaries. They cannot certify the end-to-end execution route. Certification requires a non-production authorized execution receipt from the registered adapter and runtime.

## 10. Explicit owner decisions required before implementation

The following are unresolved and must be answered by accountable owners:

1. authoritative Runtime Fabric PostgreSQL project/database and owner;
2. environment-to-database binding without disclosing secrets;
3. migration/provisioning owner, approved runner, change control and rollback authority;
4. transaction boundary for deployment state, scoped idempotency and immutable audit;
5. HOST execution interface, accountable operator and authorization mechanism;
6. registration/attestation proving the mapping from logical NODE identity to an actual execution environment;
7. permitted non-production and production execution scope;
8. MAIL release approver and authoritative approved-release source;
9. final API / Stalwart / Roundcube workload decomposition and component owners;
10. MAIL public health/readiness contract and route owner.

Project visibility, a healthy candidate database, a CI pass, an existing gateway endpoint or silence in an issue thread is not an approval.

## 11. Current disposition

**BLOCKED — design contract only.**

This document adds no executable adapter, database schema, migration, credentials, runner, host registration, bootstrap, DNS, mail routing, outbound-send capability or production deployment. The next implementation slice is the fail-closed release/profile contract and its tests, after the MAIL release approver confirms the approval source and intended component boundary. Runtime execution remains gated on the independent database and HOST owner decisions above.
