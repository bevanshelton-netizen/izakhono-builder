# IZAKHONO HOST — Execution Capacity Profiles v1

**Status:** Supplier-neutral planning specification; not a purchase order or deployment authorization.
**Owner:** IZAKHONO
**Date:** 25 November 2026

## 1. Purpose

This document defines a measurable starting point for comparing execution infrastructure. It does not assert that a host exists, select a provider, or authorize expenditure. Logical identities such as NODE01 are software roles. Every profile below describes an actual physical or virtual execution resource that must have its own provider/asset ID, ownership evidence and approval record.

The first production footprint should be deliberately small but designed so that state, backups and DNS can move to replacement infrastructure. Do not place every production role on one machine and call it a resilient cluster.

## 2. Environments

| Environment | Purpose | Admission rule |
|---|---|---|
| Development / CI | Build and automated tests | Ephemeral runners are acceptable; never production state |
| Staging | Exercise web, mail and DNS integration before public launch | Isolated test domains/data; no customer production traffic |
| Production | Customer websites, mail and control-plane services | Explicit owner approval, backup/restore, monitoring and independent acceptance |

A CI runner, Cloudflare Worker, Vercel deployment or local workstation is not a production execution host.

## 3. Supplier-neutral planning profiles

These are initial sizing envelopes for quotation and benchmarking, not guarantees. Actual sizing must be revised after load tests, retention policy, expected mailbox/site counts and service-level requirements are known.

### Profile A — staging application host

- 4 vCPU (modern x86-64 or ARM64 supported by all selected images)
- 8 GiB RAM
- 100 GiB SSD/NVMe persistent block storage
- 1 static public IPv4; IPv6 capability preferred
- Full root/administrator control and Docker Engine + Compose v2 support
- Inbound TCP 80/443 for web staging; mail ports only if a dedicated mail staging test is approved
- Outbound HTTPS; SMTP egress only where provider explicitly permits it
- Automated snapshots are not a substitute for application-consistent encrypted backups

Use for isolated HOST staging and integration tests. Do not use this single-host profile as proof of high availability.

### Profile B — initial production application host

- 8 vCPU baseline; benchmark before accepting sustained production load
- 16 GiB RAM baseline; 32 GiB preferred where PostgreSQL, MinIO, cache, web runtime and mail coexist
- 250 GiB enterprise-grade NVMe/SSD persistent storage baseline, with an independently expandable data volume
- Static public IPv4, IPv6 support, reverse-DNS/PTR control and documented bandwidth/transfer limits
- Provider must permit Docker workloads, required inbound ports and required outbound connections
- Hardware/virtualization health metrics, console recovery, firewall/security-group control and support escalation
- Encrypted off-host backups and tested restore to a different execution host

This profile is a first controlled deployment footprint, not a multi-node availability design. Separate high-risk or high-resource services as measured load and threat models require.

### Profile C — independent authoritative DNS secondary

- 2 vCPU
- 2–4 GiB RAM
- 30 GiB persistent storage
- Static public IPv4 (and IPv6 preferred)
- UDP and TCP 53 reachable from the Internet
- Separate provider, network and failure domain from the primary
- Restricted AXFR/IXFR source policy and TSIG authentication
- Independent monitoring and SOA serial/authority checks

A second VM in the same provider region, account, network or physical failure domain does not satisfy the independence requirement.

### Profile D — encrypted backup target

- Capacity initially budgeted at 2× the protected persistent data set, then adjusted for retention, change rate and restore-point objectives
- Separate account and preferably separate provider/failure domain from production
- Object-lock/immutability where available, versioning, encryption and least-privilege access
- Routine integrity verification and scheduled restore tests
- Documented egress/restore charges and recovery time

Never treat a local disk, same-host snapshot or same-provider-only backup as the sole recovery copy.

## 4. Mail-specific supplier gates

An execution provider intended to host IZAKHONO MAIL must confirm in writing:

- inbound TCP 25 permitted and not silently filtered;
- outbound TCP 25 permitted for direct delivery (or a separately approved, replaceable transport bridge);
- inbound TCP 465, 587 and 993 available;
- static public IPv4 and ability to set PTR/rDNS to `mail.izakhono.africa`;
- no policy prohibiting self-hosted SMTP, bulk abuse controls understood, and abuse-contact process available;
- sufficient disk IOPS, capacity and monitoring for durable mail queues and mailbox storage;
- network/firewall rules can be controlled without exposing Stalwart admin/JMAP listeners.

If outbound TCP 25 or PTR control is unavailable, the host is not accepted as the direct outbound mail origin. A replaceable relay may be evaluated separately, but it does not replace the owned mailbox engine.

## 5. Web-hosting and DNS gates

- Web edge: inbound TCP 80 and 443; outbound certificate-authority access.
- Customer site runtime: tenant isolation, resource limits, persistent document roots, audit and abuse controls.
- PostgreSQL: private network only, encrypted backup, tested restore and no public database port.
- MinIO: private control/data endpoints, versioning and encrypted offsite replication.
- Valkey: private network only, persistence policy and no public port.
- Authoritative DNS: UDP/TCP 53, two independent failure domains, correct parent delegation/glue and DNSSEC only after end-to-end verification.
- All public IPs, hostnames and PTR records must be verified before DNS publication.

## 6. Provider quotation checklist

For every candidate, capture the same facts:

1. Provider legal name, product/SKU and account owner.
2. Region, data-centre location and failure-domain details.
3. vCPU model, RAM, disk type/IOPS/throughput and included transfer.
4. Static IPv4 and IPv6 pricing; PTR/rDNS availability.
5. Inbound/outbound firewall control and TCP 25 policy.
6. Monthly base charge, VAT/tax, setup fees, bandwidth overage and storage/backup charges.
7. Currency, billing cycle, renewal terms, cancellation and refund terms.
8. SLA, support hours, incident escalation and maintenance policy.
9. Snapshot/backup pricing, restore/egress costs and data deletion terms.
10. Data residency, privacy terms, DPA and acceptable-use policy.
11. Console access, recovery mode, API/IaC support and export/migration path.
12. Measured network latency to intended customer markets.

Compare like-for-like monthly and annual totals. No vendor should be recommended solely on advertised CPU/RAM price.

## 7. Acceptance and placement rules

- Staging can begin on Profile A after ownership, authorization and cost are confirmed.
- Production web/mail must not be admitted on Profile A.
- Production application capacity begins with Profile B only after security, monitoring, encrypted backup and restore gates pass.
- Authoritative DNS secondary capacity must use Profile C in a distinct failure domain before registrar delegation is considered.
- Profile D must be tested by restoring to a clean, separate execution host.
- Each role-to-host binding must be recorded under the NODE01 execution-host binding contract.
- Public traffic, MX, DNS delegation, firewall exposure and production data migration require a reviewed change plan and explicit owner approval.

## 8. Cost policy and current status

No supplier has been selected and no price is represented here. Obtain current written quotations only after the region, workload profile, data residency and operational requirements are confirmed. No VM, dedicated server, storage, bandwidth, domain or recurring subscription may be ordered without explicit approval of the total cost and billing terms.

Current verified state:
- no execution host has been identified or connected through SentinelX;
- no provider infrastructure integration is connected in SentinelX;
- no host SKU, region, public IP, OS or capacity has been verified;
- no paid resource has been created or purchased;
- no DNS or mail production cutover has occurred.

## 9. Next decision gate

The next decision is not “which NODE01 machine should we install?” It is: **which real, owner-authorized execution resource or supplier can meet Profile A staging requirements and the longer-term Profile B/C/D constraints?**

Until an existing resource or supplier account is identified, the only honest status is **EXECUTION CAPACITY NOT YET ESTABLISHED**.
