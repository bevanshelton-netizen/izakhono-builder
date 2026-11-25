# IZAKHONO OWNED-HARDWARE DEPLOYMENT PLAN — V1

**Status:** Implementation plan; no physical host has yet been enrolled or inspected.  
**Owner:** IZAKHONO  
**Repository:** `bevanshelton-netizen/izakhono-builder`  
**Date:** 25 November 2026

## 1. Non-negotiable deployment principle

IZAKHONO builds and owns its hosting platform. The first deployment target is owner-controlled physical hardware, not a newly purchased VPS, managed hosting plan, or third-party hosting platform.

No purchase, subscription, paid compute allocation, domain transfer, production DNS change, or production traffic cutover is authorised by this plan. If the currently available owner-controlled machine is insufficient, stop and present the measured gap and no-cost alternatives. Any future expenditure requires a separate explicit approval.

Open-source software and replaceable upstream network services may be used. Using an ISP for connectivity or a registrar for domain registration does not transfer ownership of the IZAKHONO control plane or workloads.

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

## 3. Phase A — inspect existing owner-controlled equipment

Before installing workloads, enroll the existing machine using the approved host-management agent and perform read-only discovery.

Record and verify:
- physical/virtual status and owner confirmation;
- manufacturer/model where available;
- CPU model, cores and virtualization support;
- installed RAM and memory pressure;
- disks, capacity, health indicators, filesystem and free space;
- OS distribution/version, kernel and patch status;
- hostname, local interfaces, routes and current public-IP visibility;
- firewall state and listening ports;
- Docker/Compose availability and existing containers;
- current services, workloads and occupied ports;
- UPS/power protection, cooling and physical access arrangements;
- backup destination and whether it is independent of the primary machine.

Do not print secrets, private keys, tokens, passwords, environment-file contents or personal data into inspection output. Do not stop, restart, update, reformat, repartition, overwrite or remove existing services during discovery.

**Gate A:** No deployment until the machine's ownership, role, capacity, existing workload impact, storage health and recovery path are understood and approved.

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

**DNS-specific warning:** A sovereign authoritative DNS service needs at least two independently reachable nameserver instances in distinct failure domains. One physical machine cannot provide genuine multi-site DNS resilience. Until a second owner-controlled failure domain exists, keep the existing registrar/DNS arrangement as a clearly labelled transitional dependency; do not claim sovereign DNS is live.

## 5. Phase C — safe staging on the owned machine

After Gate A and network assessment:
1. Produce a host-specific deployment plan and resource budget.
2. Confirm the intended host paths, storage mounts and network boundaries.
3. Confirm that existing services will not be displaced.
4. Establish a tested encrypted backup before changing host state.
5. Deploy one service group at a time, beginning with the minimum HOST control/edge dependencies.
6. Use pinned and reviewed container images, persistent volumes, least-privilege identities and explicit resource limits.
7. Keep management endpoints private and require owner-controlled authentication.
8. Capture logs, health checks, versions and rollback instructions.
9. Test restart persistence and restore in an isolated target before any public exposure.

Do not run an all-in-one bootstrap blindly on a machine with unknown workloads. Existing scripts may refuse to proceed if canonical networks, volumes or services are absent; treat these guards as intentional.

## 6. Platform deployment order

The logical service sequence is:
1. Host baseline, secure operator access, monitoring and backup.
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
- any proposed hardware/network purchase and its full recurring/once-off cost;
- the operational benefit and failure-domain improvement.

Wait for explicit approval before ordering, subscribing, provisioning paid capacity or initiating a billable service.

## 9. Current blockers and next action

As of this plan's creation, SentinelX reports zero enrolled hosts and zero saved provider integrations. Therefore no physical machine has been inspected and no deployment can safely be run remotely.

The next action is to run the current one-time enrollment command on the existing owner-controlled machine. Once the host appears, perform Phase A read-only discovery. Do not interpret an enrollment token or a successful agent connection as proof that the machine is suitable for production.

The Cloudflare integration-link request has not returned a completed result and no Cloudflare integration is saved. Do not create duplicate connection jobs. Cloudflare zone access is not required for the first read-only hardware inspection.

## 10. Definition of success

The first milestone is not “containers started.” It is a verified owner-controlled host with documented capacity, a safe deployment boundary, reliable access, network feasibility, monitoring and a tested independent recovery path.

IZAKHONO HOST becomes production-ready only when each service has externally verifiable acceptance evidence, tenant/security controls, operational ownership and a proven rollback/restore procedure.
