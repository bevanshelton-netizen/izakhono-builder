# IZAKHONO SOFTWARE-DEFINED NODE AND EXECUTION DEPLOYMENT PLAN — V1

**Status:** Architecture and implementation plan; no execution environment is currently enrolled, connected or approved.  
**Owner:** IZAKHONO  
**Repository:** `bevanshelton-netizen/izakhono-builder`  
**Date:** 25 November 2026

## 1. Non-negotiable deployment principle

IZAKHONO builds and owns its hosting platform and software-defined Nodes. A Node is a logical software identity and workload boundary; it is not a physical computer, virtual machine or compute provider. Workloads execute only through a separately identified, authorised HOST execution environment. No execution environment is currently confirmed.

This plan authorises zero spend. No cloud instance, physical hardware, subscription, managed service, domain transfer, production DNS change or production traffic cutover may be created or initiated. If execution capacity is required, first document the technical requirements, available no-cost options and any proposed costs; obtain separate explicit approval before any billable provisioning.

Open-source software and replaceable infrastructure adapters may be used. Compute, network, storage and DNS are execution dependencies behind explicit interfaces; using an external execution provider does not transfer ownership of IZAKHONO's control plane, Node definitions, workloads, data model or customer services.

## 2. Scope of ownership

IZAKHONO owns and operates:
- HOST control plane, customer/service inventory and provisioning workflows;
- host operating-system configuration, workload definitions and deployment automation;
- web edge and application runtimes;
- Stalwart mail and Roundcube webmail;
- authoritative DNS service and zone data;
- PostgreSQL data plane and MinIO object storage;
- encrypted backup, restore and operational evidence;
- access policy, secrets handling, monitoring and incident procedures.

External parties may provide commodity connectivity, power-grid service, upstream routing, domain registration or peer delivery. They are not the hosting platform.

## 3. Phase A — define the logical Node and execution contract

Define each Node as a versioned software object with a stable logical identity, declared role, approved capabilities, desired state, policy bindings, workload references and audit history. Node identity must not be inferred from a machine hostname, IP address, container ID or cloud-provider resource ID.

For each workload, define a separate execution-environment record containing its provider/ownership boundary, environment identity, region or failure domain where applicable, OS/runtime, capacity, network and storage capabilities, operator authority, credential scope, health evidence and lifecycle state. Bind a Node to an execution environment only through an explicit, reviewed and auditable authorization.

The execution adapter must expose typed, allow-listed operations; it must not turn the Node control plane into arbitrary shell access. Enrollment of an execution environment is a separate process from creating or identifying a logical Node. A successful agent connection does not prove authorization, capacity, security or production suitability.

**Gate A:** Node identity, execution target, ownership/authority, isolation, capacity, network reachability, secrets boundary and recovery path must all be evidenced and approved before workload deployment.

## 4. Phase B — network and site-readiness assessment

A self-hosted public service needs reliable inbound and outbound connectivity. Verify, rather than assume:
- a stable public IPv4 address or a documented alternative routing design;
- ISP/router permission for inbound ports and port forwarding;
- no carrier-grade NAT, or a deliberate owner-controlled tunnel/reverse-proxy design with its limitations documented;
- ISP policy for outbound TCP 25 and mail-server operation;
- ability to set reverse DNS/PTR for the public mail address;
- reachability of TCP 25, 465, 587, 993, 80 and 443 from an independent network;
- UDP and TCP 53 for authoritative DNS when that phase is reached;
- firewall rules with management access restricted to approved operator sources;
- power continuity, cooling, physical security and monitoring;
- an independent encrypted backup destination.

Do not expose Stalwart administration, JMAP administration, database ports, Docker socket or host-management interfaces to the public internet.

**Mail-specific warning:** Residential or dynamic ISP connections may block SMTP, lack usable PTR control, or have poor reputation. If so, do not claim direct-to-internet mail hosting is viable on that connection. First investigate an owner-controlled network arrangement or an explicitly approved mail transport arrangement; do not silently substitute a third-party mailbox provider.

**DNS-specific warning:** A sovereign authoritative DNS service needs at least two independently reachable nameserver instances in distinct failure domains. Two instances on the same host or in the same network/site failure domain do not provide genuine resilience. Until two suitable failure domains are available, keep the existing registrar/DNS arrangement as a clearly labelled transitional dependency; do not claim sovereign DNS is live.

## 5. Phase C — safe staging on an approved execution environment

After Gate A and network assessment, and only after any required cost approval:
1. Produce an environment-specific deployment plan, resource budget and failure-domain assessment.
2. Confirm runtime, storage mounts, network boundaries and workload isolation.
3. Confirm that no existing service or tenant will be displaced.
4. Establish and test encrypted backup and recovery before changing persistent state.
5. Deploy one service group at a time, beginning with the minimum HOST control/edge dependencies.
6. Use pinned and reviewed images, persistent volumes, least-privilege identities and explicit resource limits.
7. Keep management endpoints private and require owner-controlled authentication.
8. Capture logs, health checks, versions and rollback instructions.
9. Test restart persistence and restore in an isolated target before any public exposure.

Do not run an all-in-one bootstrap against an unverified environment. Existing scripts may refuse to proceed if canonical networks, volumes or services are absent; treat these guards as intentional.

## 6. Platform deployment order

The logical service sequence is:
1. Define and validate Node identities, policy bindings, typed execution adapters and audit evidence.
2. Establish an authorised execution environment, secure operator access, monitoring and backup.
2. HOST control plane and private management plane.
3. HOST Caddy edge, initially serving a controlled test endpoint.
4. PostgreSQL and object storage with tested persistence and recovery.
5. Stalwart and Roundcube, using the repository's single canonical mail engine.
6. Mail DNS and public mail acceptance, only after address, PTR and port requirements are proven.
7. PowerDNS primary and secondary on independent owner-controlled failure domains.
8. Customer-facing provisioning only after tenant isolation, audit and restore tests pass.

No second mail engine, public HTTP edge, or competing state store may be introduced.

## 7. Mail acceptance for izakhono.africa

The five requested identities remain configured in source but are not active mailboxes:
- ceo@izakhono.africa
- sales@izakhono.africa
- info@izakhono.africa
- support@izakhono.africa
- finance@izakhono.africa

Do not publish guessed DNS records. Obtain the exact DKIM selector and value from the live Stalwart domain configuration. Verify A/AAAA, MX, SPF, DKIM, DMARC, PTR, TLS, SMTP submission, outbound delivery, inbound delivery, reply, IMAPS, webmail and encrypted backup/restore. Record timestamped evidence for each check. Only then may mailbox identities be provisioned and labelled live.

Never change production MX or nameserver delegation until a reviewed cutover plan, tested rollback and explicit owner approval exist.

## 8. Cost and procurement control

This plan authorises zero spend. Before any proposed spend, report:
- why existing owned equipment cannot meet the requirement;
- measured capacity or connectivity shortfall;
- no-cost remediation options;
- any proposed infrastructure/network purchase and its full recurring/once-off cost;
- the operational benefit and failure-domain improvement.

Wait for explicit approval before ordering, subscribing, provisioning paid capacity or initiating a billable service.

## 9. Current blockers and next action

As of this plan's creation, SentinelX reports zero enrolled hosts and zero saved provider integrations. No execution environment is currently connected or verified. This does not mean a software-defined Node is a physical host; Node definitions and execution-environment enrollment are separate concerns.

The next action is to reconcile the Node and HOST execution contracts in source, then identify an execution environment that is already available and explicitly authorised. Do not generate or run an enrollment command until its target type, authority, security scope and cost implications are known. Perform read-only discovery only after that environment is connected.

The Cloudflare integration-link request has not returned a completed result and no Cloudflare integration is saved. Do not create duplicate connection jobs. Cloudflare zone access is not required to define the logical Node model or execution adapter contracts.

## 10. Definition of success

The first milestone is not “containers started.” It is a verified software-defined Node model, an explicitly authorised execution binding, a safe deployment boundary, documented capacity, network feasibility, monitoring and a tested independent recovery path.

IZAKHONO HOST becomes production-ready only when each service has externally verifiable acceptance evidence, tenant/security controls, operational ownership and a proven rollback/restore procedure.
