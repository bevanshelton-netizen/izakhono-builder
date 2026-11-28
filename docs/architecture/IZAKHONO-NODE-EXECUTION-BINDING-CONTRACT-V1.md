# IZAKHONO Node-to-Execution Binding Contract — V1

**Status:** Proposed architecture contract; documentation only.
**Scope:** Logical Node identity, workload placement, execution-environment authority and auditable binding.
**Cost policy:** Zero spend. This contract does not authorise compute provisioning, subscriptions, provider integration, production deployment or DNS changes.

## 1. Purpose and terminology

IZAKHONO Nodes are software-defined entities. A Node is not a physical computer, virtual machine, container, Kubernetes node, cloud instance, hostname or IP address.

An **execution environment** is the separately identified compute/runtime boundary in which an approved workload actually executes. It may eventually be a self-operated environment or an explicitly authorised external environment. No provider or environment is selected by this contract.

A **workload** is a versioned deployable service or job (for example HOST, MAIL, DNS, DATA or BACKUP). A workload may be assigned to an execution environment through an explicit binding. A Node may coordinate, govern or represent workloads without being the machine on which they run.

The terms are deliberately separate:

- **Node identity:** who/what the logical Node is within IZAKHONO.
- **Node role:** what responsibilities and capabilities the Node is allowed to exercise.
- **Workload identity:** the deployable application/service and its version.
- **Execution-environment identity:** the infrastructure/runtime boundary that runs the workload.
- **Binding:** the reviewed authorization connecting a workload/Node assignment to a specific execution environment.

A hostname, IP address, container ID, agent ID or provider resource ID must never be used as a substitute for logical Node identity.

## 2. Authority boundaries

1. FORTRESS remains the policy and identity authority wherever established by the canonical repository architecture.
2. NODE01 / Runtime Fabric remains the orchestration and workload-state authority wherever established by the canonical repository architecture.
3. HOST owns hosting-domain workflows and customer-facing hosting service contracts.
4. An execution adapter is a constrained interface to an execution environment. It is not a new source of policy authority.
5. The execution environment operator controls the underlying infrastructure boundary and must be explicitly authorised to run the relevant IZAKHONO workload.
6. No adapter may elevate a Node's declared capabilities or bypass FORTRESS policy, NODE01 authorization, approval gates or audit requirements.

If the existing canonical implementation assigns a responsibility differently, this proposed contract must be reconciled with that source before implementation; it must not silently create a competing authority.

## 3. Minimum logical records

### 3.1 Node record

A Node record must contain, at minimum:

- immutable, globally unique logical Node ID;
- schema and record version;
- declared role and purpose;
- lifecycle state;
- approved capability identifiers;
- policy/authority references;
- owner/operator reference;
- creation and last-transition audit references.

Node identity is stable across workload restarts, container replacement, host migration, IP changes and provider changes. Replacing an execution environment must not silently create a new logical Node.

### 3.2 Workload record

A workload record must contain:

- immutable workload ID and application/service name;
- deployable artifact reference and immutable version/digest;
- requested runtime profile and resource envelope;
- data classification and persistence requirements;
- network exposure requirements;
- health/readiness contract;
- backup and recovery requirements;
- owning Node or approved controller reference.

### 3.3 Execution-environment record

An execution-environment record must contain:

- immutable IZAKHONO environment ID;
- provider/ownership boundary and responsible operator;
- environment lifecycle state;
- region/site/failure-domain identifiers where applicable;
- runtime/OS and supported execution capabilities;
- capacity and resource quotas;
- network, ingress/egress and storage capability declarations;
- identity/credential reference (never the secret value);
- monitoring, health and recovery evidence;
- cost classification and explicit approval reference where any charge could arise.

A provider's resource ID is metadata on this record, not its primary IZAKHONO identity.

### 3.4 Binding record

A binding is a first-class, versioned, auditable authorization containing:

- binding ID and schema version;
- logical Node ID;
- workload ID and exact artifact digest/version;
- execution-environment ID;
- requested and granted capability sets;
- policy decision and approving authority references;
- credential scope/reference;
- network and data boundaries;
- validity period and revocation state;
- creation, approval, activation, change and revocation audit events.

A binding must be rejected if any referenced identity, workload version, environment, policy decision or approval is missing, ambiguous, expired or revoked.

## 4. Lifecycle and state transitions

Node, workload, environment and binding lifecycles are separate. A change to one must not implicitly change another.

Suggested binding lifecycle:

`PROPOSED → VALIDATED → APPROVED → ACTIVE → REVOKED`

A binding may instead transition to `REJECTED` or `EXPIRED`. Only an authorised policy decision can move a binding into `APPROVED`; only a verified adapter operation and recorded evidence can move it into `ACTIVE`.

The following are not equivalent:

- Node registered ≠ execution environment enrolled.
- Agent connected ≠ environment authorised.
- Environment authorised ≠ workload deployed.
- Process running ≠ workload healthy.
- Health check passed ≠ production acceptance passed.
- CI passed ≠ production service live.

Every transition must be attributable to an actor or service identity, carry a timestamp, include a reason and correlate to an immutable audit event.

## 5. Execution-adapter contract

Adapters expose typed, allow-listed operations. They must not expose arbitrary shell execution to ordinary Node callers.

The adapter interface must support, as appropriate:

- read-only environment discovery;
- capability and quota inspection;
- workload artifact verification;
- plan/diff generation without applying changes;
- approved workload deployment;
- health and readiness inspection;
- controlled stop/rollback;
- backup and restore workflows;
- audit evidence retrieval.

Mutating operations require a valid active authorization, least-privilege credentials, policy approval and an idempotency key. Destructive operations, public exposure, persistent data changes and production cutovers require separate change approval. Adapter responses must distinguish requested, accepted, running, succeeded, failed and unknown outcomes; timeouts must not be reported as success.

No adapter may provision billable capacity under this V1 contract. Any future provisioning capability requires a separate cost-control contract and explicit owner approval.

## 6. Security and isolation requirements

- Default deny: no binding and no execution.
- Least privilege: grant only the capabilities required by the specific workload.
- Secrets are referenced through a managed secret boundary and never stored in Node records, logs or repository documentation.
- Credentials are scoped to the workload/environment and are revocable and rotatable.
- Management interfaces are private by default.
- Network ingress and egress are explicitly declared and policy checked.
- Workload data is isolated by tenant and classification.
- Execution adapters authenticate both caller and target and protect against replay.
- Audit records are append-only or tamper-evident and correlate policy, approval, adapter and runtime events.
- Revocation must prevent new actions and initiate the approved containment procedure for active workloads.
- Backup and restore must be tested independently of the primary execution environment.

## 7. Placement and failure-domain rules

Placement is an explicit policy decision, not an implicit side effect of Node identity.

Before a workload is bound, validate resource headroom, runtime compatibility, persistence, network reachability, data residency/classification constraints, backup destination, recovery objectives and failure-domain requirements.

Redundant services must not be described as highly available merely because multiple logical Nodes or containers exist. Independent failure domains must be evidenced. In particular, authoritative DNS redundancy requires independently reachable instances in distinct network/site failure domains.

## 8. Required evidence gates

| Gate | Required evidence | Failure outcome |
|---|---|---|
| Identity | Stable Node, workload and environment IDs | Reject binding |
| Authority | Explicit operator and policy approval | Reject binding |
| Capability | Runtime, resource and network compatibility | Block placement |
| Security | Credential scope, isolation and network policy | Block activation |
| Cost | Zero-cost confirmation or separate written owner approval | Block provisioning |
| Operations | Monitoring, backup and tested recovery plan | Block production |
| Acceptance | Independent service-level tests and rollback evidence | Keep non-production |

## 9. Initial implementation sequence

1. Reconcile this contract with the canonical FORTRESS, NODE01, Runtime Fabric and HOST source implementations.
2. Identify existing identity, policy, workload-state and audit schemas; reuse canonical records rather than creating parallel registries.
3. Define typed schemas and validation for Node, workload, execution environment and binding records.
4. Implement read-only discovery and plan/diff adapter operations first.
5. Add authorization, idempotency, audit correlation and revocation tests.
6. Add a non-production adapter only after an execution environment is identified and explicitly authorised.
7. Prove deployment, health, rollback, backup and restore in an isolated test environment before production consideration.

## 10. Explicit non-goals

This contract does not:

- assert that an execution environment currently exists or is connected;
- select a cloud, VPS, hardware vendor or hosting provider;
- create or enrol physical/virtual compute;
- grant SentinelX or another agent authority over NODE01;
- authorise arbitrary remote command execution;
- provision Stalwart, Roundcube, HOST, DNS or customer workloads;
- change DNS, MX, firewall rules, production data or customer traffic;
- authorise spending.

**Current operational status:** no execution environment is confirmed connected or approved. The logical Node model can be specified and validated independently; runtime deployment remains blocked until the execution authority and environment are established.
