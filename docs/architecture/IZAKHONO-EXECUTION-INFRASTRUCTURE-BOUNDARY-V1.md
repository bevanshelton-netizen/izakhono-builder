# IZAKHONO Execution Infrastructure Boundary — v1

**Status:** Architecture clarification and discovery procedure; no host has been identified, enrolled, provisioned or approved for production.
**Owner:** IZAKHONO
**Date:** 25 November 2026

## 1. Purpose and correction

This document makes the execution-infrastructure boundary explicit and supersedes any wording elsewhere that implies NODE01 is a physical machine or that an existing IZAKHONO-controlled Linux server has already been identified.

**NODE01 is software: a logical node identity and orchestration/execution component within Runtime Fabric. It is not a computer, VM, server, cloud instance, IP address or SentinelX host.** A logical NODE01 identity may be bound to an execution target only through a separately approved, evidenced binding process.

The term **execution host** means the physical or virtual compute resource that actually runs workloads. Its identity, ownership, provider, location/failure domain, operating system, capacity, network and authorization are independent facts that must be discovered and recorded.

SentinelX is an optional management/inspection agent for a real execution host. Enrolling a SentinelX host does not create a server, prove ownership, make it NODE01, or authorize production deployment.

## 2. Four distinct layers

| Layer | Meaning | What it is not |
|---|---|---|
| IZAKHONO HOST | Owned hosting platform and customer-facing control plane | A physical server |
| NODE01 / Runtime Fabric | Logical software identity, orchestration and workload-state boundary | A VM, machine or IP |
| Execution host | Actual physical server, VM or dedicated compute resource | The logical NODE01 identity |
| SentinelX | Optional host-management and inspection connection | Compute capacity or a hosting provider |

FORTRESS remains the policy/identity authority. It governs authorization; it does not become a physical execution host.

## 3. Execution-host source categories

The infrastructure discovery process must determine which of these is actually available. Do not assume any category exists until evidence supports it.

1. **IZAKHONO-owned physical equipment:** identify the asset, custodian, site, power, cooling, network, public reachability and failure domain.
2. **Existing rented infrastructure:** identify the supplier, account owner, resource ID, contract, renewal/cost, region, operating system and access authority.
3. **Colocation or dedicated server:** identify the equipment owner, facility, remote-hands arrangement, cross-connect/transit, power and service commitments.
4. **New supplier capacity:** evaluate only after comparing requirements and obtaining a written cost estimate. No resource may be created or purchased without explicit owner approval.
5. **No available execution resource:** record this as the current state and prepare a supplier-neutral bill of materials and options; do not pretend a server exists.

A developer workstation, CI runner, Vercel deployment, Cloudflare zone, GitHub repository, SentinelX account or logical NODE01 identity must not be silently promoted to the production execution host.

## 4. Discovery record required before enrollment

For each candidate execution host, collect and verify:

- asset/resource identifier and stable hostname;
- legal/account owner and evidence of IZAKHONO's authority to administer it;
- supplier, contract and recurring/usage cost where applicable;
- physical location or cloud region and failure domain;
- operating system/version and support lifecycle;
- vCPU, RAM, storage type/capacity/health and growth headroom;
- public/private addressing, routing, bandwidth and reverse-DNS/PTR control;
- firewall/security-group rules and required inbound/outbound ports;
- virtualization/container capability and existing workloads;
- backup target, encryption, retention and restore evidence;
- monitoring, alert route, maintenance and incident contacts;
- named operator identity, least-privilege access and audit path;
- intended environment: development, CI, staging or production.

Unknown values remain explicitly **UNKNOWN**. Do not infer ownership or capacity from a hostname, a previous project, or a provider integration.

## 5. NODE01 binding contract

A NODE01-to-execution-host binding is a controlled deployment record, not a naming convention. It must include:

- logical NODE01 identity and Runtime Fabric owner;
- immutable execution-host resource identity;
- environment and workload roles;
- approved operator/service identity and FORTRESS authorization reference;
- allowed operation classes and isolation boundary;
- network and storage mappings;
- deployment revision and configuration evidence;
- health/heartbeat and monitoring evidence;
- rollback, recovery and decommission procedure;
- owner approval and timestamp.

The binding is invalid if the host is offline, ownership is unverified, the resource identity is ambiguous, authorization is missing, or the target has not passed its preflight checks. Rebinding must be audited. A SentinelX host ID may be recorded as one management reference, but it is not the authoritative infrastructure identity.

## 6. Safe execution sequence

1. **Inventory:** inspect repository, connected-provider metadata and available account records without changing infrastructure.
2. **Candidate identification:** establish whether an actual physical/virtual execution host exists and who controls it.
3. **Read-only validation:** where authorized access exists, inspect OS, capacity, storage, network, ports and existing workloads. Do not install agents or alter configuration before scope and host identity are confirmed.
4. **Cost and suitability:** produce a host-specific bill of materials, capacity assessment, operational risk and supplier cost estimate.
5. **Owner approval:** obtain explicit approval for any purchase, recurring charge, agent installation, firewall change, DNS change or deployment.
6. **Management enrollment:** only then enroll the real host using the approved management path. Never describe enrollment as provisioning.
7. **NODE01 binding:** establish and test the logical-to-physical mapping under Runtime Fabric/FORTRESS authorization.
8. **Staging:** deploy staging workloads, backups, monitoring and restore drills.
9. **Production admission:** require service-specific external acceptance evidence, rollback readiness and explicit production authorization.

No DNS delegation, MX, public traffic, firewall exposure, production data or customer workload changes are permitted merely because a host has been enrolled.

## 7. Current verified state (25 November 2026)

- NODE01 is treated as a logical software identity, not a physical machine.
- The SentinelX account currently reports zero enrolled hosts. This means no SentinelX-connected execution host is available for inspection through that integration; it does **not** prove that no physical or virtual infrastructure exists elsewhere.
- The user has not confirmed running a SentinelX installation command on any machine.
- No physical/virtual execution host, supplier account, resource identifier, public IP, OS, capacity or owner-authorized management path has been established in this workflow.
- No server has been purchased or provisioned by this work.
- PR #695 (canonical Stalwart/Roundcube mail integration) is merged into main at `d9f9b12cf09a9b260cbcc3a6ded984a6688a3871`. Source merge is not runtime deployment.
- PR #756 (owned-hosting platform foundation) is merged into main at `8a96f8a4dddaec00212f217d6812f012b6623a7f`.
- Mail runtime, public DNS and end-to-end delivery remain operationally unverified unless fresh external evidence establishes otherwise.

## 8. Immediate work queue

1. Reconcile the current mainline HOST, Stalwart/Roundcube and PowerDNS implementation and identify remaining code-level acceptance gaps.
2. Inventory connected infrastructure-provider integrations and account metadata; do not create resources.
3. Establish the actual execution-host source/owner/resource identity, if one exists.
4. If no host is identified, prepare supplier-neutral sizing and cost comparisons for an owner decision.
5. Verify domain registration and DNS authority through a secure provider connection; read-only inspection first.
6. Bind NODE01 to a real execution target only after host identity, owner authority, preflight and approval are evidenced.
7. Deploy staging before production and retain all production gates.

## 9. Cost, safety and truthfulness rules

- No compute, storage, domain, bandwidth or other paid resource may be created or purchased without an explicit estimate and approval.
- No secret, API token, private key or password may be pasted into chat.
- No production DNS, registrar delegation, MX, firewall, traffic or data change without an approved change plan.
- No host is called NODE01; no NODE01 identity is called a machine.
- No service is called LIVE based on code, CI, enrollment, a running process or a provider API response alone.
- If a prerequisite is missing, continue safe repository, design, test and read-only discovery work; report the exact external dependency without inventing progress.
