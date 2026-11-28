# IZAKHONO HOST — Automated Deployment and Configuration-Validation Blueprint

**Document status:** Architecture and implementation blueprint; not deployed  
**Version:** 1.0  
**Date:** 26 November 2026  
**Repository:** `bevanshelton-netizen/izakhono-builder`  
**Related documents:**
- `IZAKHONO-HOST-SUPPLIER-DUE-DILIGENCE-REQUEST-V1.md`
- `IZAKHONO-HOST-STAGING-ACCEPTANCE-TEST-PLAN-V1.md`
- `IZAKHONO-HOST-TRUEHOST-SUPPLIER-ASSESSMENT-V1.md`

---

## 1. Objective

Define a repeatable, auditable deployment system for IZAKHONO HOST that can configure and validate approved services on replaceable infrastructure without making the hosting platform dependent on a particular supplier.

The deployment system must make the same declared configuration produce the same intended service state, detect drift, validate prerequisites, stop safely on failure and retain evidence of what changed.

This document is a blueprint. It does not assert that a pipeline, runner, control plane, host agent, service or production environment has been installed or deployed.

## 2. Architectural principles

1. **IZAKHONO owns the control plane.** Supplier APIs and machines are capacity interfaces, not the platform's source of truth.
2. **Separate control plane from workload data plane.** A control-plane failure must not silently corrupt customer workloads or data.
3. **Supplier-neutral execution.** Provider-specific adapters translate an approved capacity request into provider-specific operations. Service configuration remains provider-independent.
4. **Declarative desired state.** Service definitions, versions, dependencies, ports, storage, health checks and policy are version-controlled.
5. **Reconciliation before mutation.** Observe actual state, calculate the difference, present a plan and require authorization for consequential changes.
6. **Fail closed.** Missing evidence, unknown host identity, policy failure or failed validation blocks deployment.
7. **Least privilege.** Each pipeline stage and service identity receives only the permissions it needs.
8. **No customer shell access.** Customers use validated product APIs and control-panel workflows, never arbitrary host command execution.
9. **No hidden production actions.** DNS, firewall, registrar, MX, routing, customer data and production traffic changes require separate reviewed approvals.
10. **NODE01 is software.** NODE01 denotes a logical software/orchestration identity, not a physical or virtual execution host. Execution hosts have independent inventory identities.

## 3. Logical system model

### 3.1 Control plane

The control plane owns:
- tenant and service metadata;
- desired-state definitions and approved release versions;
- policy evaluation and authorization;
- deployment plans and approvals;
- provider adapter selection;
- inventory and execution-host identity;
- audit events and deployment evidence;
- health and drift summaries.

The control plane must not store plaintext service credentials in source control or ordinary application tables. Secrets are references to an approved secret-management facility.

### 3.2 Execution plane

Execution hosts run approved workload services. Each host is independently inventoried with supplier resource ID, region, OS, network identity, capacity, role, authorization status and lifecycle state.

The execution plane receives narrowly scoped deployment artifacts and signed/verified instructions. It must not accept arbitrary commands supplied by a tenant or untrusted API caller.

### 3.3 Logical identities

- **FORTRESS:** policy and identity authority, as defined by the wider IZAKHONO architecture.
- **NODE01:** logical software/orchestration identity. It is not a machine and does not imply that an execution host exists.
- **Runtime Fabric:** software boundary responsible for workload placement and runtime lifecycle.
- **Execution host:** an actual physical or virtual resource with its own inventory ID.
- **Provider adapter:** supplier-specific integration that requests or inspects capacity through documented provider interfaces.

These identities must remain distinct in code, documentation, logs, diagrams and inventory.

## 4. Repository layout proposal

The following is a target layout, not a claim that these paths already exist:

```text
izakhono-builder/
  platform/
    catalog/
      services/
      plans/
    desired-state/
      environments/
      hosts/
      policies/
    adapters/
      providers/
    deploy/
      planner/
      executor/
      approvals/
      rollback/
    validate/
      schema/
      policy/
      integration/
      acceptance/
    observability/
      dashboards/
      alerts/
  infra/
    modules/
    environments/
      staging/
      production/
  services/
    web/
    mail/
    dns/
    database/
    object-storage/
    cache/
  security/
    threat-models/
    access-policies/
    secret-policies/
  docs/
    runbooks/
    change-records/
    evidence/
```

Adopt incrementally. Do not create empty directories or speculative code merely to make the tree appear complete. Keep service configuration and provider adapters independently testable.

## 5. Service catalog contract

Every deployable service must declare a machine-validated manifest. The exact schema should be implemented and versioned before a production executor is built.

Illustrative service manifest:

```yaml
apiVersion: hosting.izakhono.africa/v1
kind: ServiceDefinition
metadata:
  name: caddy
  version: "approved-version"
  owner: platform-web
spec:
  image:
    reference: "registry.example.invalid/caddy"
    digest: "sha256:REPLACE_WITH_VERIFIED_DIGEST"
  runtime:
    type: container
    replicas: 1
    resources:
      cpu: "declared"
      memory: "declared"
  network:
    ingress:
      - name: https
        protocol: tcp
        port: 443
        exposure: private-until-approved
  storage:
    mounts: []
  dependencies: []
  health:
    readiness:
      type: http
      path: /health
      timeoutSeconds: 5
  security:
    runAsNonRoot: true
    privileged: false
    readOnlyRootFilesystem: true
    secretReferences: []
  backup:
    required: false
  rollout:
    strategy: replace-after-validation
    automaticRollback: false
```

The example is illustrative. The placeholder image digest is intentionally invalid and must never be deployed. Real manifests must pin trusted images by immutable digest, validate against a versioned schema and pass policy checks.

### Required manifest properties

- stable service name and owner;
- manifest schema version;
- immutable artifact/image digest and provenance;
- resource requests and limits;
- declared dependencies and startup order;
- ingress/egress intent;
- persistent-volume requirements;
- health and readiness checks;
- secret references, never secret values;
- identity and security context;
- backup/restore classification;
- upgrade, rollback and data-migration behavior;
- supported environment and compatibility constraints.

Unknown fields should be rejected unless the schema explicitly permits extensions.

## 6. Environment and release model

Maintain distinct environments:

- **Development:** local or isolated developer testing with synthetic data.
- **Staging:** supplier-approved, isolated execution host; synthetic tenant and test data only.
- **Production:** separately approved customer-facing resources, data and traffic.

Promotion must move the same immutable artifact between environments. Do not rebuild an artifact with different contents for production.

A release record should include:
- source commit and repository;
- build identifier;
- artifact digest;
- dependency and software bill of materials (SBOM);
- vulnerability/policy scan results;
- manifest/schema version;
- target environment and host inventory IDs;
- approver identities and approval timestamps;
- deployment plan hash;
- validation results;
- rollback reference.

No artifact is eligible for production solely because CI passed or staging started successfully.

## 7. Pipeline stages and mandatory gates

### Stage 0 — Source and change integrity

- Require reviewed changes on protected branches.
- Verify commit provenance and build origin.
- Run formatting, static analysis and secret scanning.
- Reject unapproved dependency sources and mutable production image tags.
- Preserve review and build evidence.

**Block if:** source provenance is uncertain, a secret is detected, or required review is missing.

### Stage 1 — Schema and policy validation

- Validate manifests against the declared schema.
- Validate image references and immutable digests.
- Check resource, port, storage and dependency declarations.
- Enforce least privilege, non-root defaults and no privileged containers.
- Detect conflicting ports, undeclared public exposure and missing health checks.
- Check environment-specific policy.

**Block if:** schema is invalid, policy is violated or a required property is unknown.

### Stage 2 — Artifact build and verification

- Build from reviewed source in a controlled runner.
- Pin dependencies and base images.
- Generate SBOM and artifact digest.
- Scan dependencies and images.
- Sign artifacts where the selected signing infrastructure supports verifiable identity.
- Store immutable artifacts in an approved registry.

**Block if:** build is not reproducible enough for the defined policy, signature/provenance fails, or a critical unresolved vulnerability is found.

### Stage 3 — Target and supplier preflight

- Resolve the target from the host inventory, never from free-form user text.
- Verify host owner, resource ID, supplier, region, role and authorization status.
- Verify OS support, capacity, network policy, recovery access and staging acceptance status.
- Verify the target is not production unless the separate production release workflow is invoked.
- Confirm the provider adapter has only the scoped permissions required.

**Block if:** target identity is ambiguous, host is not approved for the role, supplier terms prohibit the workload, or authorization has expired.

### Stage 4 — Plan and approval

- Observe current state using read-only operations.
- Compute a deterministic desired-versus-actual plan.
- Classify each action: additive, reversible, disruptive, data-migrating, public exposure or destructive.
- Produce a human-readable diff and machine-readable plan hash.
- Require explicit approval for the exact target and plan hash.
- Recompute if target state changes before execution.

**Block if:** plan includes an unapproved destructive, public-facing, data-migrating or production action.

### Stage 5 — Controlled execution

- Execute only typed, allowlisted operations from approved service modules.
- Use short-lived credentials where possible.
- Keep deployment credentials separate from service runtime identities.
- Apply bounded timeouts and idempotent operations.
- Record each action and its result.
- Stop on the first failed mandatory action; do not continue in a partially trusted state.

No arbitrary shell command, script body or customer-supplied executable may be passed through the deployment API.

### Stage 6 — Post-deployment validation

- Check service process/container state.
- Check readiness and dependency connectivity.
- Verify only intended ports are exposed.
- Verify logs, metrics and audit events.
- Verify tenant isolation with synthetic test identities.
- Verify backup policy is active where required.
- Run service-specific integration and acceptance tests.

**Block promotion if:** a health check fails, an unexpected port is exposed, isolation fails, or required evidence is missing.

### Stage 7 — Promotion and observation

- Keep staging and production promotion separate.
- Require production change record, explicit approval and maintenance/rollback plan.
- Apply only the already verified immutable artifact.
- Monitor defined service-level indicators and error budgets after approval.
- Halt further rollout on defined regression thresholds.

### Stage 8 — Closeout

- Record final state, artifact digest, plan hash and test results.
- Record deviations, unresolved defects and risk owners.
- Update inventory and release history.
- Confirm temporary credentials and test resources are revoked or removed.
- Retain evidence according to approved retention policy.

## 8. Drift detection and reconciliation

Reconciliation must be read-only by default.

1. Fetch current declared desired state.
2. Observe actual service and host state using approved read-only interfaces.
3. Normalize both representations.
4. Calculate a deterministic difference.
5. Classify drift by severity and scope.
6. Produce an alert and proposed remediation plan.
7. Require approval before any consequential mutation.

Drift categories:
- **Informational:** harmless metadata difference.
- **Configuration:** service setting differs from desired state.
- **Security:** access, exposure, patch or policy differs.
- **Capacity:** resource allocation or usage differs materially.
- **Integrity:** artifact digest, configuration signature or data integrity differs.
- **Critical:** unexpected privileged access, unknown service, public admin exposure or suspected compromise.

Automatic remediation is prohibited for destructive, public exposure, identity, credential, customer-data, DNS, mail-routing and production traffic changes. Those require separate authorization and change control.

## 9. Rollback and data migration

Rollback is service-specific; a container restart is not a universal rollback strategy.

For stateless services:
- retain the last known-good immutable artifact;
- verify compatibility and health before switching;
- restore prior routing only through an approved change.

For stateful services:
- document schema and data migrations;
- use backward-compatible expand/contract migrations where feasible;
- take and verify backups before approved changes;
- test restoration and application compatibility in isolation;
- never automatically restore an old database snapshot over newer customer data.

Automatic rollback must be disabled where it could destroy, overwrite or make state inconsistent. Require an operator decision and a recovery plan.

## 10. Provider adapter contract

Provider adapters must expose a small, typed interface and must not leak provider-specific concepts into the service catalog.

Conceptual operations:
- `discoverCapabilities()` — read-only capability discovery;
- `listResources(scope)` — list resources within authorized account scope;
- `getResource(resourceId)` — inspect exact resource;
- `planCapacity(request)` — return a proposed resource plan, no mutation;
- `provision(plan, approval)` — only after separate explicit authorization;
- `inspectNetwork(resourceId)` — read-only network facts;
- `exportResource(resourceId)` — where provider supports safe export;
- `terminate(resourceId, approval)` — separate high-risk approval and confirmation.

Every operation must:
- validate tenant/account scope;
- validate resource IDs against inventory;
- log actor, request, outcome and correlation ID;
- use idempotency keys for supported mutations;
- return structured errors;
- avoid logging secrets;
- support dry-run or plan-only behavior where applicable.

Provider adapters must not provision resources as a side effect of discovery or planning.

## 11. Security and trust model

### Identities

Use separate identities for:
- human operators;
- CI/build workers;
- deployment controller;
- provider adapter;
- each service runtime;
- backup jobs;
- monitoring agents.

Do not reuse one all-powerful credential across these roles.

### Secret lifecycle

- Store secret material only in an approved secret-management system.
- Inject secrets at runtime through a narrow, audited mechanism.
- Prefer short-lived credentials and workload identity.
- Rotate credentials on schedule and after suspected exposure.
- Revoke temporary deployment credentials after use.
- Keep secret values out of CI logs, artifacts, crash dumps and support tickets.

### Supply-chain controls

- Pin dependencies and base images.
- Generate SBOMs.
- Verify signatures and provenance where available.
- Restrict registries and package sources.
- Track vulnerability exceptions with owner and expiry.
- Rebuild on critical security updates through the same review gates.

### Audit

Every plan, approval, execution, validation, rollback and credential lifecycle event must have:
- actor/service identity;
- timestamp;
- target inventory ID;
- change/request correlation ID;
- source commit and artifact digest where relevant;
- action and result;
- evidence reference.

Audit records must be protected from alteration by the workload identity being audited.

## 12. Service-specific deployment order

The eventual order is dependency-driven and subject to separate design and approvals. A possible logical sequence is:

1. Host baseline, time synchronization, access and monitoring.
2. Encrypted backup agent and recovery validation.
3. Private network and service identity foundations.
4. PostgreSQL and Valkey.
5. MinIO.
6. Native application runtime and Caddy.
7. Stalwart mail and Roundcube, only after mail gates pass.
8. Authoritative DNS primary and independent secondary, only after network and failure-domain checks.
9. Customer-facing control-plane and tenant workflows, after their own security review.

This is not an instruction to install these components now. DNS and mail are especially sensitive and remain gated by supplier capability, public DNS and routing approvals.

## 13. Metrics and operational signals

At minimum, define and test:
- deployment success/failure rate;
- deployment duration by service and environment;
- plan-to-execution drift;
- configuration validation failures;
- host CPU, memory, disk and network saturation;
- service readiness and restart rate;
- backup completion and restore-test success;
- certificate expiry;
- queue depth for mail where deployed;
- DNS authoritative health where deployed;
- security policy violations;
- audit event delivery delay.

Metrics must avoid tenant secrets and unnecessary customer content. Alert thresholds must be tuned from measured staging behavior, not invented as production SLOs.

## 14. Implementation sequence

### Phase A — Specification and validation foundation
- Agree the service manifest schema.
- Define policy rules and test fixtures.
- Define host inventory schema and lifecycle states.
- Define release record and evidence format.
- Add schema validation and static tests to CI without deployment credentials.

### Phase B — Read-only inventory and plan generation
- Implement host inventory read model.
- Implement provider capability discovery with read-only scopes.
- Implement deterministic desired/actual diff.
- Generate human-readable plans and plan hashes.
- Test using fixtures and mocked provider responses.

### Phase C — Staging executor
- Select one explicitly approved staging host.
- Complete supplier due diligence and staging acceptance first.
- Implement narrowly scoped operations for one stateless test service.
- Require manual approval of the exact plan hash.
- Validate logs, health, rollback and evidence capture.

### Phase D — Stateful services
- Add PostgreSQL, MinIO and Valkey with isolated synthetic data.
- Prove backup and restore before considering persistent staging workloads.
- Test migrations and service-specific recovery.

### Phase E — Sensitive services
- Add Stalwart and Roundcube only after written provider permission and network/PTR gates.
- Add authoritative DNS only with independent failure domains and a reviewed change plan.
- Keep production MX, DNS delegation and public routing out of staging automation.

### Phase F — Production release governance
- Complete threat model, independent security review, restore exercises and operational runbooks.
- Define production SLOs from evidence.
- Establish incident, rollback, supplier-exit and data-protection procedures.
- Obtain explicit production authorization before any cutover.

## 15. Definition of done

The blueprint is implemented only when:
- schemas and policy checks are versioned and tested;
- read-only inventory and plan generation work against authorized test fixtures;
- plan hashes and approvals are enforced by the executor;
- provider adapters cannot mutate resources through discovery or plan-only calls;
- execution is typed, allowlisted, least-privileged and auditable;
- a staging workload can be deployed and validated reproducibly;
- tenant isolation and secrets controls pass;
- backup restoration is demonstrated;
- rollback and supplier exit are rehearsed;
- no service is described as production-ready without independent acceptance evidence.

## 16. Current status and authorization

At the time this document is written:
- this is an architecture blueprint only;
- no deployment pipeline is claimed as implemented by this document;
- no provider API credentials or deployment credentials are configured;
- no execution host is identified or enrolled;
- NODE01 remains a logical software identity;
- no host or service has been provisioned;
- no mail, DNS, firewall, registrar, customer-data or production traffic changes are authorized.

The next implementation step should be schema and policy validation using local fixtures and CI checks only. Do not add provider credentials, host enrollment, infrastructure provisioning or production mutation to that step.
