# IZAKHONO HOST — Truehost Supplier Assessment v1

**Status:** Candidate supplier assessment; not a selection, endorsement, purchase order, or deployment authorization.  
**Date:** 25 November 2026  
**Owner:** IZAKHONO

## 1. Executive decision

Truehost is recorded as a **potential execution-capacity supplier** for IZAKHONO HOST. The supplied Truehost South Africa page advertises domain registration, web hosting, email hosting, VPS hosting, dedicated servers, website-builder services and reseller hosting.

The page establishes that these product categories are marketed. It does **not**, by itself, establish the technical specifications, exact region, mail-port availability, reverse-DNS control, acceptable-use permission for self-hosted mail, service levels, or total cost of any specific server product.

**Decision: evaluate; do not purchase yet.** No Truehost account, server, subscription, DNS change, integration or production deployment is assumed by this assessment.

## 2. Strategic fit

IZAKHONO's objective is to operate its own hosting platform and customer services. Truehost, if selected, would supply replaceable compute/network/storage capacity only.

IZAKHONO must retain control of:
- its platform source code, service definitions and deployment process;
- tenant identity, account lifecycle, authorization and audit records;
- customer-facing website and mailbox provisioning workflows;
- authoritative DNS policy and zone data;
- mail-domain policy, mailbox data, keys and backup/restore procedures;
- security standards, monitoring, incident response and supplier exit/migration.

Do not substitute Truehost shared web hosting, hosted mailboxes or a reseller package for the owned IZAKHONO runtime. Such products may be useful for unrelated or temporary workloads, but they do not satisfy the target architecture for an independently operated website and email hosting platform.

## 3. Candidate product classes

| Truehost product class shown on supplied page | Potential use | Assessment |
|---|---|---|
| VPS hosting | Isolated development/staging; possibly production after specification and acceptance | Candidate; require full root access and technical confirmation |
| Dedicated servers | Higher-control production execution capacity | Candidate; request exact SKU and full quotation |
| Web hosting | Conventional provider-managed website hosting | Not the target runtime for IZAKHONO HOST |
| Email hosting | Provider-managed mailboxes | Not the target Stalwart-based IZAKHONO MAIL runtime |
| Reseller hosting | Reselling provider-managed hosting | Does not establish ownership of the underlying platform/runtime |
| Domain registration | Domain registration/management if needed | Separate from compute capacity; do not transfer or change domains without approval |
| Website builder | Provider-managed site creation | Not the target native IZAKHONO web runtime |

The supplied page contains no specific VPS or dedicated-server CPU, RAM, storage, IOPS, network, location, IPv4, PTR or price details. These must be obtained from current product specifications and a written quotation rather than inferred.

## 4. Fit against IZAKHONO execution profiles

### Staging capacity

Initial planning profile:
- 4 vCPU;
- 8 GiB RAM;
- 100 GiB persistent SSD/NVMe;
- full root access;
- static public IPv4 preferred;
- Docker Engine and Compose v2;
- inbound TCP 80/443;
- console/recovery access and provider firewall controls.

A Truehost VPS may be suitable if a specific SKU meets these conditions. Do not treat a marketing label such as “cloud VPS” as proof.

### Initial production application capacity

Initial planning profile:
- 8 vCPU baseline;
- 16 GiB RAM minimum planning baseline, with 32 GiB preferred for co-located PostgreSQL, MinIO, cache, web and mail workloads;
- at least 250 GiB persistent SSD/NVMe, expandable data volume preferred;
- static public IPv4, IPv6 capability preferred;
- full root access, console recovery, firewall control and measurable network limits;
- encrypted off-host backup and tested restore to a separate execution resource.

A dedicated server may be a better candidate for this profile, but only its exact hardware, storage layout, network and support terms can determine suitability. Do not infer suitability from the product category alone.

### Independent authoritative DNS secondary

This role requires a separate resource in a genuinely distinct provider/network failure domain:
- 2 vCPU;
- 2–4 GiB RAM;
- 30 GiB persistent storage;
- static public IP;
- inbound UDP and TCP 53;
- authenticated, restricted AXFR/IXFR;
- independent monitoring.

A second server in the same failure domain does not provide the required independence. Do not assume that a second Truehost instance would meet this requirement without confirming its actual location and network topology.

### Backup target

Use a separate account and preferably a separate provider/failure domain. Require encryption, versioning/immutability where available, documented retention, restore/egress costs and successful restore tests. A same-host disk or snapshot is not the sole backup.

## 5. Mandatory written mail-hosting confirmation

Before any mail workload is placed with Truehost, obtain written answers for the exact proposed SKU and account:

1. Is self-hosting Stalwart for normal business/customer mail permitted under the applicable acceptable-use policy?
2. Is inbound TCP 25 available?
3. Is outbound TCP 25 permitted for direct-to-MX delivery, and are there rate limits or reputation prerequisites?
4. Are inbound TCP 465, 587 and 993 available?
5. Is a dedicated static IPv4 supplied, and can IZAKHONO set its PTR/rDNS to the approved mail hostname (planned: `mail.izakhono.africa`)?
6. Are IPv6 and IPv6 reverse DNS available, and can IPv6 mail be disabled if it is not fully configured?
7. Are there restrictions on hosting multiple customer domains/mailboxes or operating a commercial hosting platform?
8. What abuse monitoring, complaint handling, suspension and appeal procedures apply?
9. Are firewall rules, outbound network controls and required ports configurable by the account owner?
10. What are the disk IOPS/throughput guarantees or limits for mail queues and mailbox storage?

If direct outbound TCP 25 is unavailable, record the server as **not eligible for direct outbound mail**. A separately evaluated, replaceable SMTP relay may be considered later; it must not replace IZAKHONO's owned Stalwart mailbox engine. Do not route mail through an unapproved relay or misrepresent delivery capability.

## 6. Standard supplier questionnaire

For every proposed Truehost SKU, capture:

- legal supplier and exact product/SKU;
- data-centre country, city/region and failure-domain details;
- CPU model, vCPU allocation/oversubscription policy, RAM;
- disk type, usable capacity, RAID/mirroring, IOPS and throughput;
- included traffic, network speed, overage pricing and latency;
- IPv4/IPv6 allocation, extra-IP pricing and PTR/rDNS controls;
- inbound/outbound firewall control and port 25 policy;
- root access, supported OS images, Docker support and virtualization restrictions;
- console, rescue/recovery and API/IaC capabilities;
- SLA, maintenance windows, support hours and incident escalation;
- snapshots, backup options, retention, restore process and egress charges;
- data residency, privacy terms, DPA, security certifications and deletion policy;
- monthly price, VAT, setup fees, billing currency, minimum term, prepayment, renewal price, cancellation and refund terms;
- migration/export options and resource termination/data deletion process.

Compare equivalent monthly and annual totals. Record promotional and renewal prices separately. A low introductory price must not conceal a long prepaid term or materially higher renewal charge.

## 7. Proposed low-risk engagement sequence

1. Request technical answers and written quotation only; do not place an order.
2. Verify exact SKU, location, mail policy, IP/PTR capability and all recurring/one-off charges.
3. Compare at least one alternative supplier using the same questionnaire.
4. If an existing paid-for resource is already available, inspect that resource before considering another purchase.
5. If a new staging resource is proposed, present the complete cost and billing commitment for explicit approval.
6. After approval only, bind the separately identified physical/virtual execution resource to the relevant software orchestration role. NODE01 remains a software identity, not a computer or server.
7. Build isolated staging, run security and functional tests, then test backup and restore.
8. Production placement requires a separate reviewed change plan and explicit approval. Public DNS, MX, firewall exposure, registrar delegation, customer traffic and production data must not be changed by this assessment.

## 8. No-cost work completed by this assessment

This document adds a reusable supplier evaluation record and a technical acceptance checklist to the existing supplier-neutral execution-capacity profiles. It creates no external account, infrastructure resource, subscription, purchase, network change or deployment.

The assessment also prevents a category error: Truehost's domain, shared web-hosting and hosted-email offerings are not equivalent to an owner-controlled VPS or dedicated execution resource.

## 9. Current status and unresolved evidence

- Truehost is a candidate only; no supplier selection is made.
- The supplied marketing page confirms that Truehost advertises VPS and dedicated-server product categories, among other services.
- No exact Truehost SKU has been technically verified in this record.
- No written confirmation of Stalwart/self-hosted mail permission, TCP 25, PTR/rDNS, static IP or multi-tenant hosting permission is recorded.
- No verified price, renewal term, server location or SLA is recorded for a proposed execution SKU.
- No Truehost resource or integration is connected or provisioned by this work.
- No public DNS, MX, mail routing, firewall or production state has been changed.
- Production website and email hosting remain **not deployed and not externally verified**.

## 10. Reference links

- Truehost South Africa: https://truehost.co.za/
- VPS hosting: https://truehost.co.za/vps-hosting/
- Dedicated servers: https://truehost.co.za/hosting/dedicated-servers/
- Web hosting: https://truehost.co.za/hosting/
- Email hosting: https://truehost.co.za/hosting/email/
- Contact/support: https://truehost.co.za/contact-us/

**Next gate:** obtain written technical confirmation and a complete quotation for a specific VPS or dedicated-server SKU. No purchase or commitment is authorized by this document.
