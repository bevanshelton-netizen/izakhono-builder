# IZAKHONO HOST — Preliminary South African Infrastructure Supplier Market Scan

**Status:** Public-information screening only; no supplier is selected, approved, contacted or purchased from.  
**Date:** 26 November 2026  
**Repository:** `bevanshelton-netizen/izakhono-builder`

## 1. Purpose and decision boundary

This scan broadens the supplier-neutral assessment beyond Truehost so IZAKHONO does not anchor its infrastructure decision on a single provider. It identifies candidates whose publicly advertised infrastructure appears worth putting through the same exact-SKU due-diligence questionnaire.

Public product pages are not contracts, independent performance tests, written mail-policy approval or proof that an advertised SKU is currently orderable. Prices are indicative snapshots and can change. No weighted score is assigned because hard-gate evidence is missing.

**No-go until verified:** written self-hosted Stalwart/customer-mail permission; inbound and outbound port availability; static IPv4 and PTR/rDNS control; exact server location and failure domain; complete price/renewal terms; root and recovery access; backup/restore; and supplier exit terms.

## 2. Candidate shortlist

### A. HostSA — local VPS candidate

Public VPS page advertises Cape Town data-centre hosting, AMD EPYC, NVMe, full root, IPv4/IPv6, static IPv4 and snapshots. Published VPS 8 GB is 8 vCPU / 8 GB / 320 GB at R849/month; VPS 16 GB is 8 vCPU / 16 GB / 512 GB at R1,349/month; VPS 32 GB is 8 vCPU / 32 GB / 640 GB at R1,949/month. Page says prices include VAT, no setup fee, and annual payment receives one month free.

**Preliminary fit:** VPS 16 GB aligns with the initial CPU/RAM/storage planning baseline; VPS 32 GB offers more memory headroom. This is only a paper fit. Confirm whether CPU allocation is guaranteed, storage performance, traffic policy, backup scope, console/recovery, exact data-centre/failure domain, and mail permissions/ports/PTR.

Official product page: https://www.hostsa.net/vps/

### B. Hostnali — local/African VPS candidate, location clarification required

Public VPS page lists an Advanced plan at R5,700/month with 8 vCPU, 16 GB RAM and 320 GB storage, and an Enterprise plan at R11,370/month with 16 vCPU, 32 GB RAM and 640 GB storage. It describes KVM, full root, IPv4 and IPv6. The page distinguishes International VPS (Europe/USA) from African VPS; the published table must be tied to the selected location in a written quote before comparing costs.

A separate managed VPS page advertises an Executive tier at R1,122/month with 8 vCPU, 24 GB RAM and 300 GB SSD, including managed service. This is a different product/price presentation and should not be mixed with the self-managed page without a like-for-like quote.

**Preliminary fit:** advertised CPU/RAM/storage can meet the planning profile, but clarify location, recurring price, managed-service scope, backup inclusion and whether full root remains available. Mail policy/ports/PTR are unverified.

Official pages:
- https://hostnali.co.za/vps-hosting-south-africa-price/
- https://hostnali.co.za/hosting/managed-vps/

### C. cloud.co.za — local cloud VPS candidate

Public Linux cloud-server page describes South African cloud infrastructure and KVM-based VPS with full root access. It lists LN4 at 8 vCores, 32 GB memory and 400 GB SSD, with a displayed first-month promotional amount of R480 and stated regular price of R1,600/month. LN3 is 6 vCores, 16 GB and 360 GB, displayed at R306 first month then R1,020/month. Fair-use terms apply to the stated unlimited bandwidth.

**Preliminary fit:** LN4 appears to exceed the planning baseline on paper. Confirm exact data-centre location, recurring charge and contract terms, CPU allocation, storage performance, network fair-use limits, backups, console/recovery, static IP/PTR and self-hosted mail permission.

Official page: https://cloud.co.za/cloud-servers/

### D. HostAfrica — local dedicated and virtual-dedicated candidate

Public dedicated-server page advertises South African/Johannesburg infrastructure, self-managed bare metal, full root, remote management/IPMI access and on-site technicians. It lists a Metal Core Linux 8 configuration at R2,340/month with 8 cores/16 threads, 16 GB ECC RAM and 1 TB SSD (2 × 500 GB). It also lists a Linux Virtual Dedicated Server at R1,080/month with 3 vCore, 24 GB ECC RAM and 450 GB NVMe.

**Preliminary fit:** Metal Core Linux 8 meets the advertised CPU-thread count and storage baseline but has 16 GB RAM only; check whether memory can be expanded and at what cost. Confirm exact hardware, RAID/mirroring, network capacity, IP/PTR, port 25, dedicated server location and full contract terms.

Official page: https://hostafrica.co.za/servers/dedicated-servers/

### E. Astra Hosting — Johannesburg VPS candidate

Public page advertises Johannesburg cloud VPS, KVM, NVMe, full root and one IPv4 address. The Cloud VPS 6 listing is 8 vCPU, 32 GB RAM, 320 GB NVMe and 10 TB traffic at €113.79/month. Servers are described as unmanaged by default, with managed service as an add-on.

**Preliminary fit:** advertised Cloud VPS 6 aligns with the planning baseline. Price is in EUR and therefore carries exchange-rate/payment-fee exposure. Confirm exact Johannesburg facility, VAT and final billing, static IP/PTR, outbound and inbound mail ports, mail acceptable-use policy, backups, console/recovery and exit terms.

Official page: https://www.astrahosting.com/vps/south-africa/

## 3. Initial comparison against the planning profile

The planning profile for a single initial production application host is 8 vCPU, 16 GiB RAM minimum, preferably 32 GiB when co-locating database, object storage, cache, web and mail workloads, and at least 250 GiB persistent SSD/NVMe. This is a planning threshold, not a final capacity benchmark.

| Candidate | Publicly listed configuration that appears closest | Indicative public price | First-pass observation |
|---|---|---:|---|
| HostSA | 8 vCPU / 16 GB / 512 GB NVMe | R1,349/month | Strong paper fit; Cape Town location advertised |
| Hostnali | 8 vCPU / 16 GB / 320 GB | R5,700/month on listed VPS table | Paper fit; selected location and price basis need confirmation |
| cloud.co.za | 8 vCPU / 32 GB / 400 GB | R1,600/month regular after first-month promo | Strong paper fit; validate fair use and exact location |
| HostAfrica | 8 cores / 16 threads / 16 GB / 2 × 500 GB SSD | R2,340/month | Bare-metal option; memory headroom/upgrade cost to verify |
| Astra Hosting | 8 vCPU / 32 GB / 320 GB NVMe | €113.79/month | Strong paper fit; Johannesburg advertised; foreign-currency cost |

These prices are not normalized total-cost-of-ownership quotes. They may differ in VAT, term, setup, backup, management, support, IP, traffic, renewal and cancellation. Do not select a provider by this table.

## 4. Cross-provider mail and infrastructure questions

Send the same written questions to every shortlisted supplier only after explicit authorization to contact them:

1. Is Stalwart self-hosting for ordinary business and customer mail explicitly permitted on this exact SKU?
2. Are inbound TCP 25, 465, 587 and 993 available?
3. Is outbound TCP 25 enabled for direct-to-MX delivery without a ticket or manual exception? What rate limits apply?
4. Is a dedicated static IPv4 supplied, and can the customer control PTR/rDNS for `mail.izakhono.africa`?
5. Can IPv6 reverse DNS be configured, or can IPv6 mail be disabled safely?
6. Are multiple customer domains/mailboxes and commercial hosting explicitly permitted?
7. What abuse, reputation, suspension and appeal policies apply?
8. What CPU allocation/oversubscription, storage IOPS/throughput and network fair-use limits apply?
9. What are the exact data-centre city, upstream network, facility/failure-domain and data-residency details?
10. What console/rescue access, API/IaC, firewall control, independent backup and tested restore support are provided?
11. What is the complete amount payable now, recurring price, VAT, setup, minimum term, prepayment, renewal, overage, egress, cancellation and refund terms?
12. How can all platform state, databases, object data, DNS zones and mailboxes be exported during exit?

Written answers tied to the exact SKU and account are mandatory. A generic FAQ or verbal assurance does not pass the gate.

## 5. Recommendation

Do not select a supplier yet. Put **HostSA, cloud.co.za, HostAfrica and Astra Hosting** into the next written evidence round alongside Truehost. Hostnali remains on the list but needs explicit clarification of the selected location and the material price difference between its published VPS and managed VPS offers.

For the first technical comparison, request quotes for:
- one 8-vCPU / 16–32 GB / at least 250 GB SSD/NVMe staging-capable or application-capable VPS;
- one dedicated server option with at least 8 physical cores/threads as specified by the supplier, 32 GB RAM preferred and mirrored or otherwise resilient storage;
- a separate DNS-secondary resource in a distinct provider/network failure domain;
- an independent encrypted backup target.

Do not combine the DNS secondary or backup target with the primary host and call that resilience. A supplier that fails mail gates may still be eligible for a non-mail workload, but must not be presented as an approved mail origin.

## 6. Evidence and status

This is a preliminary public-page scan performed on 26 November 2026. It is not a security audit, contractual review, benchmark, endorsement or supplier recommendation.

- No supplier has been contacted.
- No quote has been requested.
- No supplier account or resource has been created.
- No purchase, subscription, DNS, firewall, mail routing or production change has occurred.
- No candidate has passed hard gates or received a weighted score.
- IZAKHONO retains ownership of its platform and service control plane; suppliers remain replaceable capacity providers.
- NODE01 remains a logical software identity, not a physical or virtual machine.

**Next gate:** authorize a supplier-contact round, or continue with no-cost architecture and technical preparation. Contact, purchase and deployment are separate decisions; this scan authorizes none of them.
