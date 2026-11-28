# IZAKHONO HOST — Supplier-Independent Staging Acceptance and Test Plan

**Document status:** Engineering test specification; not executed  
**Version:** 1.0  
**Date:** 26 November 2026  
**Repository:** `bevanshelton-netizen/izakhono-builder`  
**Related assessment:** `IZAKHONO-HOST-SUPPLIER-ASSESSMENT-V1.md`  
**Related supplier questionnaire:** `IZAKHONO-HOST-SUPPLIER-DUE-DILIGENCE-REQUEST-V1.md`

---

## 1. Purpose and governing rules

This plan defines how IZAKHONO HOST will independently assess a supplier-provided staging execution host before approving it for any production role. The supplier's product description, sales response, control-panel status, or advertised SLA is not a substitute for test evidence.

The plan is designed to be supplier-neutral and repeatable. The same test definitions and acceptance thresholds must be applied to each candidate, with deviations recorded rather than silently relaxed.

**This is a plan, not a report of completed tests.** No host has been identified or enrolled, no staging environment is represented as deployed, and no result in this document should be interpreted as a pass.

### Non-negotiable boundaries

- No purchase, trial that creates a charge, account upgrade or resource provisioning without separate explicit approval.
- No installation or execution against a host until its owner, identity, operating system, address, access method and authorization are confirmed.
- NODE01 is a logical software identity/orchestration role. It is not a physical or virtual machine. A real execution host must have its own separate inventory identity.
- No tests against third-party systems, public IP ranges or supplier infrastructure beyond the exact resources and scope the supplier and IZAKHONO have authorized.
- No production DNS, registrar delegation, MX, firewall, routing, customer data or customer traffic changes under this staging plan.
- No customer-facing arbitrary shell execution. Administrative test access is limited to authorized operators and controlled test environments.
- No secrets in source control, test output, issue comments or logs. Use a secrets manager or approved encrypted secret injection.
- No destructive, load, mail-abuse, vulnerability exploitation or denial-of-service testing. Performance testing must be bounded, scheduled and explicitly authorized.
- Every test must record date/time, operator, target inventory ID, software/version, method, evidence location, result and any deviation.

---

## 2. Acceptance model

Each test receives one of these statuses:

| Status | Meaning |
|---|---|
| PASS | Required evidence exists and every stated acceptance criterion is met. |
| FAIL | Evidence demonstrates that a mandatory criterion is not met. |
| BLOCKED | Test cannot safely or validly run because a prerequisite, authorization or dependency is missing. |
| NOT RUN | Test has not been attempted. |
| NOT APPLICABLE | Approved reviewer records why the test does not apply to this specific role. |

A missing result is never a pass. A supplier assertion without independently checkable evidence is recorded as **supplier claim only**, not PASS.

### Release gates

- **Gate 0 — Authorization:** exact host, owner, scope, spend approval (if applicable), operator and test window are documented.
- **Gate 1 — Supplier suitability:** hard contractual and technical gates for the proposed role are evidenced in writing.
- **Gate 2 — Host identity and access:** inventory, console recovery, privileged access and host ownership are verified.
- **Gate 3 — Security baseline:** hardening, isolation, secrets and audit controls pass.
- **Gate 4 — Workload capability:** only the services intended for the staging role pass their tests.
- **Gate 5 — Backup and recovery:** encrypted off-host backup and a successful isolated restore are demonstrated.
- **Gate 6 — Operational readiness:** monitoring, alerting, support escalation, capacity and supplier exit are evidenced.
- **Gate 7 — Role decision:** named reviewers approve or reject the host for a specific role. Staging acceptance does not authorize production.

A failed mandatory gate blocks progression. A blocked test remains open and cannot be converted to PASS by assumption.

---

## 3. Test environment and inventory

Before testing, create an inventory record with these fields:

| Field | Required value |
|---|---|
| Host inventory ID | Unique ID for the actual execution resource |
| Supplier and account owner | Legal supplier and IZAKHONO account owner |
| Product/SKU | Exact contracted product |
| Region/facility | Country, city and facility where disclosed |
| Host type | VPS, dedicated, cloud instance or other |
| OS image/version | Exact release and image provenance |
| CPU | Model, vCPU count and sharing/guarantee status |
| Memory | Allocated RAM |
| Storage | Device type, usable size, RAID/replication and limits |
| Network | Interface speed, transfer policy, static IP details |
| Access | Console, rescue and administrative access methods |
| Backup target | Separate account/failure domain and location |
| Responsible operator | Named authorized operator |
| Authorization reference | Approval record and permitted test scope |

Do not place passwords, private keys, API tokens or recovery codes in this inventory.

### Reference staging profile

The current planning profile is a target for supplier comparison, not proof of available capacity:

- 4 vCPU and 8 GiB RAM as a minimum staging reference.
- 100 GiB persistent SSD/NVMe as a planning baseline.
- Full administrative access and a recovery console.
- Static addressing where required for the test.
- Ability to run the intended container/runtime stack without policy restrictions.
- Independent encrypted backup destination.

If a candidate differs, record the difference and its impact. Do not silently redefine the profile to make a supplier pass.

---

## 4. Test catalogue

### A. Authorization, identity and recovery

**STG-001 — Authorization and scope**

Method: verify signed/recorded approval, supplier terms, named operator, exact host identifier, target addresses and permitted test window.

Pass criteria:
- The host is explicitly controlled by IZAKHONO or its authorized supplier account.
- The test scope and operator are documented.
- No production or unrelated target is included.
- Any cost-bearing activity has separate approval.

**STG-002 — Resource identity**

Method: compare supplier control-panel resource ID, console identity, assigned addresses and operating-system identity against the inventory record.

Pass criteria:
- All identifiers refer to the same actual execution resource.
- The resource is not confused with NODE01 or another logical software identity.
- The supplier, region and product match the accepted quote.

**STG-003 — Console and recovery**

Method: in a controlled window, demonstrate authorized console access, rescue/recovery path, reboot procedure and documented account recovery without exposing credentials.

Pass criteria:
- Authorized operator can reach the console.
- Recovery instructions are usable and supplier escalation route is known.
- Recovery does not depend solely on the guest OS or a single SSH session.

### B. Capacity and resource integrity

**STG-010 — CPU and memory allocation**

Method: collect OS-visible CPU/memory data and compare with the contracted SKU. Use bounded, non-disruptive sampling; request supplier evidence for CPU sharing and sustained-use limits.

Pass criteria:
- Visible allocation matches the contract.
- CPU model, vCPU/core meaning and oversubscription status are documented.
- Memory is stable under normal staging load.
- Any quota, steal-time or throttling limitation is disclosed and accepted.

**STG-011 — Storage identity and durability**

Method: inspect block devices, filesystem capacity, mount options and storage reporting; compare with supplier specification. Do not run destructive disk benchmarks.

Pass criteria:
- Usable capacity meets the approved staging profile.
- SSD/NVMe type and any RAID/replication claims are evidenced.
- Expansion, IOPS/throughput limits and failure behavior are documented.
- Filesystem and mount configuration meet the platform's operational needs.

**STG-012 — Network capacity and policy**

Method: inspect assigned interfaces, routes, MTU and supplier bandwidth/transfer policy. Run only low-volume connectivity checks to approved endpoints.

Pass criteria:
- Network allocation and transfer policy match the quote.
- Static IP, change process, firewall ownership and rate limits are understood.
- No unexpected public service is exposed.
- Any test traffic remains within the authorized scope.

**STG-013 — Bounded performance baseline**

Method: after explicit test-window approval, run a short, low-impact CPU, memory, disk and network baseline. Capture tool versions, parameters and raw results. Do not run stress or saturation tests.

Pass criteria:
- Results are repeatable enough to establish a baseline.
- No unexplained resource throttling or severe I/O/network contention appears during the bounded test.
- Results and limitations are recorded; no unsupported production capacity claim is made.

### C. Operating system and security

**STG-020 — OS provenance and patch state**

Method: record distribution, release, kernel, image source and installed security updates.

Pass criteria:
- OS is supported and receives security updates.
- Image provenance and patch responsibility are known.
- No unsupported or end-of-life release is accepted.

**STG-021 — Administrative access controls**

Method: review authorized accounts, SSH policy, MFA at supplier control plane, key-based access, privilege escalation and recovery procedure.

Pass criteria:
- Named individual accounts are used where supported.
- Root login over remote interactive access is disabled or tightly controlled under an approved break-glass design.
- Key-based access is enforced for operator access.
- MFA protects supplier control-plane accounts.
- Privileges follow least-privilege principles and are auditable.

**STG-022 — Host firewall and exposed services**

Method: compare host firewall policy and listening sockets with an approved service inventory. Scan only the owned staging host and only within the authorized scope.

Pass criteria:
- Only approved services and ports are reachable.
- Administrative interfaces are private, restricted or loopback-bound.
- Default-deny inbound policy is in place where compatible with the approved design.
- No supplier management port is inadvertently exposed by the guest configuration.

**STG-023 — Secrets handling**

Method: inspect configuration and deployment process for credentials, tokens, private keys and encryption keys. Use synthetic test secrets.

Pass criteria:
- No live secret is committed to the repository or written to ordinary logs.
- Secrets are injected through an approved secret-management path.
- Access is restricted and auditable.
- Rotation and revocation procedures are documented.

**STG-024 — Audit and time integrity**

Method: verify system time synchronization, administrative event capture, log access controls and retention policy.

Pass criteria:
- Time is synchronized and timezone is explicit.
- Privileged actions and material configuration changes are logged.
- Logs are protected from ordinary workload users.
- Retention, export and incident review processes are documented.

**STG-025 — Tenant and workload isolation**

Method: deploy only synthetic test tenants and test applications. Attempt only approved cross-tenant access checks using documented test identities and data.

Pass criteria:
- Tenant A cannot read, modify or enumerate Tenant B data or secrets.
- Application workloads cannot access host administration interfaces.
- Resource and network boundaries are enforced.
- Test evidence contains no real customer data.

### D. Platform runtime and services

These tests apply only if the corresponding component is part of the staging scope. A successful container launch alone does not establish production readiness.

**STG-030 — Container runtime**

Method: install/use the approved Docker Engine and Compose versions from trusted sources; deploy a harmless test workload.

Pass criteria:
- Runtime is supported and patchable.
- Workloads run without privileged mode unless an approved exception exists.
- Images are pinned and sourced from approved registries.
- Persistent volumes and resource limits behave as specified.

**STG-031 — Native web runtime and Caddy**

Method: deploy a non-public test application behind Caddy using a private test hostname or controlled hosts-file mapping.

Pass criteria:
- Requests route to the intended application.
- TLS is tested using an approved test certificate or private CA.
- Default and unknown hostnames do not expose another tenant.
- Caddy administration is not publicly reachable.
- No public DNS or customer traffic is changed.

**STG-032 — PostgreSQL**

Method: deploy a test database with synthetic records and separate roles.

Pass criteria:
- Network access is restricted to authorized application components.
- Application role cannot administer the database.
- Backups can be produced and restored into an isolated test instance.
- Connection limits, storage growth and logs are observable.

**STG-033 — MinIO object storage**

Method: create isolated test buckets, users and synthetic objects.

Pass criteria:
- Bucket and identity policies enforce tenant separation.
- Anonymous access is disabled unless a specific public-object design is approved.
- Encryption, versioning/retention and backup behavior are documented.
- Administrative console is private.

**STG-034 — Valkey cache**

Method: deploy a test instance with authenticated, restricted network access.

Pass criteria:
- No public unauthenticated access.
- Application access is limited to intended network identities.
- Persistence requirements and cache-loss behavior are explicitly defined.
- Secrets are not exposed in logs.

**STG-035 — Stalwart mail engine (conditional)**

Run only after written supplier permission for self-hosted mail, required port and PTR confirmation, and explicit authorization for the specific mail tests.

Method: use a controlled test domain/mailbox and synthetic messages. Start with local-only delivery and protocol/TLS checks. External delivery tests require separate authorization and a deliberately limited recipient set.

Pass criteria:
- The exact mail workload is permitted by contract and policy.
- Required ports are reachable in the intended direction.
- Static IP and PTR/rDNS are correct and independently verified.
- SPF, DKIM and DMARC are generated from the actual configuration and publicly verified only after a separately approved DNS change.
- Authenticated submission, IMAPS and Roundcube access work.
- No open relay; unauthenticated relay attempts are rejected.
- Inbound/outbound delivery, queue handling, TLS, logs and abuse controls are tested within approved scope.

No live mailboxes or production MX changes are created by this plan.

**STG-036 — Authoritative DNS (conditional)**

Method: validate BIND or PowerDNS configuration in an isolated test zone, with primary/secondary instances in distinct failure domains.

Pass criteria:
- Zone data is versioned and changes are auditable.
- AXFR/IXFR is authenticated and restricted to the authorized secondary.
- Recursive service is disabled on authoritative-only servers unless specifically required and approved.
- Serial changes, reloads, transfer failures and recovery are observable.
- DNSSEC is not enabled until key management, rollover and external validation are separately tested.

No registrar delegation or production zone modification is authorized here.

### E. Backup, restore and resilience

**STG-040 — Backup encryption and separation**

Method: create synthetic test data and verify backup encryption, destination identity, access separation and retention.

Pass criteria:
- Backup target is outside the source host's failure domain.
- Data is encrypted in transit and at rest.
- Backup credentials are separate from workload credentials.
- Retention and deletion policies are documented.
- Backup completion is observable and produces an auditable record.

**STG-041 — Restore test**

Method: restore a known synthetic dataset into a clean, isolated environment. Verify checksums, database consistency and object counts.

Pass criteria:
- Restore completes without relying on the original host's local disks.
- Checksums and application-level consistency checks pass.
- Restore duration and operator steps are recorded.
- Any missing data or manual recovery step is documented.
- A backup that has never been restored is not accepted as proven recoverable.

**STG-042 — Recovery and failure exercise**

Method: conduct a tabletop exercise first. A controlled component restart or simulated dependency failure may follow only with explicit test-window approval.

Pass criteria:
- Detection, escalation, recovery owner and decision path are clear.
- No uncontrolled data loss occurs in the approved exercise.
- Recovery objectives are measured rather than assumed.
- Supplier responsibilities and escalation contacts are known.

### F. Operations and supplier exit

**STG-050 — Monitoring and alerting**

Method: trigger harmless test alerts for resource threshold, service unavailability, backup failure and certificate expiry.

Pass criteria:
- Alerts identify the affected inventory ID and service.
- Alerts reach the designated operator.
- Alert acknowledgement and escalation are recorded.
- Monitoring does not leak secrets or customer data.

**STG-051 — Support escalation**

Method: validate support channels and response commitments using a non-urgent, authorized enquiry or supplier documentation review.

Pass criteria:
- Contracted support hours and severity definitions are known.
- Escalation path and incident reference process are usable.
- Actual observed response is recorded separately from advertised SLA.

**STG-052 — Export and supplier exit**

Method: in staging, export application configuration, database dump, object data, DNS zone files and deployment definitions. Confirm formats can be read independently.

Pass criteria:
- Data and configuration are portable in documented formats.
- Export does not require the supplier's proprietary control plane to interpret core data.
- Egress, snapshot, termination and deletion costs are known.
- Credentials can be revoked and supplier access terminated.
- A migration rehearsal can be planned without a production cutover.

---

## 5. Role-specific decision

A host receives a separate outcome for every intended role. Record **Approved**, **Rejected** or **Blocked** with evidence and reviewer.

| Role | Additional mandatory evidence |
|---|---|
| Staging application host | Gates 0–6 applicable to staging; bounded capacity; isolation; restore test |
| Production web/application host | All production security, availability, capacity, monitoring, backup, recovery and exit gates; independent review |
| Stalwart mail host | Written self-hosted mail permission; inbound/outbound TCP 25; 465/587/993; static IPv4; PTR; deliverability and abuse controls |
| Authoritative DNS primary | Authoritative-only behavior; access control; zone audit; monitoring; recovery |
| Authoritative DNS secondary | Separate provider/facility/network failure domain; authenticated transfers; independent reachability |
| Backup target | Separate account and failure domain; encryption; retention; restore evidence; deletion/export process |

Passing staging tests does not automatically approve production. A host suitable for web workloads may be unsuitable for mail or DNS.

---

## 6. Evidence package

For each test, retain:

1. Test ID and exact version of this plan.
2. Approval and scope reference.
3. Host inventory ID and supplier SKU.
4. Operator and UTC timestamp.
5. Command/tool and version, with sensitive arguments redacted.
6. Expected and observed result.
7. Evidence artifact path in an access-controlled location.
8. PASS/FAIL/BLOCKED/NOT RUN/NOT APPLICABLE status.
9. Reviewer and any corrective action.

Evidence must be reproducible without disclosing passwords, private keys, customer content or unnecessary personal data. Screenshots alone are insufficient for protocol, backup or integrity claims where machine-readable evidence can be retained safely.

### Test record template

| Field | Entry |
|---|---|
| Test ID | |
| Target inventory ID | |
| Authorization reference | |
| Operator / reviewer | |
| Date/time (UTC) | |
| Method and tool version | |
| Expected result | |
| Observed result | |
| Evidence reference | |
| Status | NOT RUN |
| Defect / deviation | |
| Remediation owner and due date | |

---

## 7. Defect severity and disposition

- **Critical:** unauthorized access, tenant data exposure, open relay, exposed administrative control plane, unencrypted sensitive backup, inability to recover essential data, or a test outside authorization. Stop testing, contain safely and escalate.
- **High:** mandatory security, isolation, backup, mail-policy or recovery criterion fails. Block the affected role.
- **Medium:** material operational weakness with a defined mitigation. Approval requires a documented risk owner and time-bound remediation; mandatory gates cannot be waived informally.
- **Low:** documentation or usability issue without material security, availability or data-integrity impact. Track to closure.

Any exception must identify the exact requirement, reason, compensating control, risk owner, expiry date and approving authority. Legal, supplier-policy, data-protection, tenant-isolation and explicit authorization requirements are not waivable by an engineering test operator.

---

## 8. Current execution status

At publication of this document:

- No actual execution host is identified in the current evidence set.
- NODE01 remains a logical software identity, not a machine.
- No SentinelX host enrollment is confirmed.
- No staging runtime is claimed as installed or running.
- No network, port, performance, restore, mail or DNS acceptance test has been executed.
- No supplier has been approved.
- No public DNS, registrar, MX, firewall or customer traffic change has been made under this plan.

All tests therefore begin as **NOT RUN** or **BLOCKED**, not PASS.

## 9. Approval record

This document establishes test criteria only. Before execution, record separate approval for:
- the exact host and account;
- the test scope and operator;
- any cost-bearing resource;
- any bounded performance test;
- any external mail test;
- any public DNS or firewall change (outside this plan);
- any production deployment (outside this plan).

**NODE01 invariant:** NODE01 is software/logical identity and orchestration only. It must never be entered as the physical or virtual host under test.
