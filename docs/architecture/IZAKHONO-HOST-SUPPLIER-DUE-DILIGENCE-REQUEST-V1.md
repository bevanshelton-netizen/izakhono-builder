# IZAKHONO HOST — Supplier Technical Due-Diligence Request Template

**Document status:** Draft template only. Not sent.  
**Version:** 1.0  
**Date:** 26 November 2026  
**Applies to:** Truehost, HostSA, Hostnali, cloud.co.za, HostAfrica, Astra Hosting and any replacement candidate.

---

## 1. Email draft

**Subject:** Technical Due Diligence and Quotation Request — IZAKHONO HOST Infrastructure

Dear Technical Sales Team,

IZAKHONO is evaluating infrastructure suppliers for an independently operated hosting platform. We are conducting a technical and commercial assessment before making any supplier or purchasing decision.

We are interested in owner-controlled VPS and/or dedicated infrastructure. The supplier would provide replaceable compute, network and storage capacity; IZAKHONO would operate and retain control of its own hosting platform, service configuration, customer provisioning, security policies and data.

At this stage, we are requesting written technical information and an itemised quotation only. This is not an order, reservation, commitment to purchase or authorization to provision a server.

Please answer the questions below against the exact product/SKU you recommend. Where an answer depends on a particular plan, region or account configuration, please identify that dependency explicitly.

### A. Exact product and capacity

1. What exact VPS or dedicated-server SKU do you recommend for an initial workload requiring approximately 8 vCPU (or equivalent dedicated CPU capacity), 16–32 GB RAM and at least 250 GB persistent SSD/NVMe?
2. Is CPU capacity dedicated, guaranteed, shared or oversubscribed? Please state the CPU model, core/thread allocation and any sustained-use limits.
3. What storage technology is used? Please state usable capacity, RAID/mirroring arrangement, IOPS/throughput limits and whether volumes can be expanded without rebuilding the server.
4. What network speed, monthly transfer allowance, fair-use policy, latency commitments and overage charges apply?
5. What country, city and data-centre/facility would host the exact SKU? Can you identify the relevant network and infrastructure failure domain?

### B. Administrative and automation control

6. Does the customer receive full root/administrator access?
7. Are KVM/IPMI or equivalent console, rescue, recovery and reinstall facilities available?
8. Are Docker Engine and Docker Compose supported without prohibited virtualization or nested-container restrictions?
9. Is there a documented API or infrastructure-as-code interface for provisioning, inspection, resizing and termination? Please provide documentation links and identify API permissions/limits.
10. Can the customer control inbound and outbound firewall rules, static IP assignment and network security policy?

### C. Email hosting — mandatory written confirmation

IZAKHONO intends to operate its own Stalwart mail engine for business and customer mailboxes. We are not asking to use a provider-managed shared email product.

11. Is self-hosting Stalwart for ordinary business and customer email explicitly permitted on this exact SKU and under your acceptable-use policy?
12. Is inbound TCP 25 available?
13. Is outbound TCP 25 permitted for direct-to-MX delivery? Is approval required, and what rate limits or reputation requirements apply?
14. Are inbound TCP 465, 587 and 993 available?
15. Is a dedicated static IPv4 included? Can the customer set or request PTR/rDNS for `mail.izakhono.africa`?
16. Can IPv6 reverse DNS be configured? If not, can IPv6 mail traffic be disabled without disabling unrelated IPv6 connectivity?
17. Are multiple customer domains, customer mailboxes and commercial hosting operations permitted?
18. What abuse-reporting, complaint handling, suspension, notification and appeal procedures apply?

Please answer each item individually. A general statement that “email is supported” is not sufficient.

### D. Security, support and resilience

19. What account MFA, access logging, role separation and account recovery controls are available?
20. What patching and vulnerability responsibilities belong to the supplier versus the customer?
21. What SLA applies? Please provide availability exclusions, maintenance windows, support hours, severity definitions and escalation targets.
22. What backup or snapshot products are available? State whether backups are stored outside the host's failure domain, encryption options, retention, restore charges and data-egress costs.
23. Can we export server images, volumes, snapshots and network configuration? What are the data deletion and termination procedures?
24. What incident notification process applies to security events, data loss or infrastructure outages?

### E. Complete commercial quotation

25. Please provide the exact SKU, region, currency and itemised price.
26. State the total payable upfront, billing interval, minimum term, prepayment requirement, VAT/tax, setup fees, IP charges, backup charges and any management fees.
27. State the renewal price after any promotion, including the full renewal billing period.
28. State traffic overage, backup restore, snapshot, data egress, IP replacement and cancellation charges.
29. What refund, cancellation, suspension and service termination terms apply?
30. How long is this quotation valid?

Please attach or link the applicable product specification, acceptable-use policy, SLA, privacy/data-processing terms, backup policy and API documentation.

We appreciate your written response. We are comparing suppliers on technical suitability, operational control, mail-delivery capability, resilience, portability and full contract cost. No purchase or provisioning is authorized at this stage.

Kind regards,

**IZAKHONO HOST**  
Infrastructure Evaluation

---

## 2. Supplier response register

Create one copy per supplier. Do not combine answers from different products or regions.

| Field | Response |
|---|---|
| Supplier legal name | Not yet completed |
| Sales/technical contact | Not yet completed |
| Exact SKU / product URL | Not yet completed |
| Quote reference and expiry | Not yet completed |
| Data-centre location | Not yet completed |
| Currency and tax basis | Not yet completed |
| Date requested / received | Not yet completed |
| Evidence attachments/URLs | Not yet completed |
| Reviewer | Not yet completed |

### Evidence status values

Use only:
- **Verified in writing** — supplier response or contract document directly supports the answer.
- **Public claim only** — marketing page or generic documentation; not a SKU-specific commitment.
- **Verbal only** — not sufficient to pass a hard gate.
- **Unknown** — no usable evidence.
- **Failed** — supplier confirms the requirement cannot be met.
- **Not applicable** — explain why and obtain reviewer acceptance.

### Hard-gate result

| Gate | Evidence status | Pass / fail / blocked | Notes |
|---|---|---|---|
| Exact SKU, location and capacity | Unknown | Blocked | |
| Root/admin and recovery access | Unknown | Blocked | |
| CPU/storage/network performance | Unknown | Blocked | |
| Stalwart and customer-mail permission | Unknown | Blocked for mail | |
| TCP 25, 465, 587 and 993 | Unknown | Blocked for mail | |
| Static IPv4 and PTR/rDNS control | Unknown | Blocked for direct mail | |
| Security and support | Unknown | Blocked | |
| Independent backup and restore | Unknown | Blocked for production | |
| Full cost and renewal terms | Unknown | Blocked | |
| Export, deletion and supplier exit | Unknown | Blocked | |
| Explicit financial approval | Not requested | Blocked | |

A public webpage may be used to identify questions, but it cannot change an unknown hard gate to pass unless it contains a clear, applicable and current contractual commitment for the exact SKU.

---

## 3. Normalized cost worksheet

For each exact SKU, calculate and record:

- Initial amount payable (including all mandatory prepayment, setup, tax and IP charges).
- Contracted recurring amount and billing interval.
- Effective monthly cost over the committed term.
- Renewal cost and renewal interval.
- Optional but operationally required costs: independent backups, additional storage, extra IPs, managed support, monitoring and mail relay (if separately approved).
- Expected annual data-egress and traffic overage costs.
- Cancellation, migration, restore and exit costs.
- Currency exposure and payment fees.

Do not compare a three-year prepayment monthly equivalent with a true month-to-month price without showing the full upfront cash commitment and renewal rate.

---

## 4. Role-specific approval

A supplier can be eligible for one role and ineligible for another. Record a separate decision for:

- staging/application development;
- production web/application runtime;
- Stalwart mail origin;
- authoritative DNS primary;
- independent authoritative DNS secondary;
- encrypted off-host backup.

Passing the application-host gates does not imply mail eligibility. A mail-ineligible provider may still be evaluated for a non-mail role. DNS secondary and backup must be placed in genuinely independent failure domains.

---

## 5. Authorization boundary

This template does not authorize the user or assistant to send the inquiry, create a supplier account, accept terms, request a trial that creates a charge, order a server, provide identity or payment documents, provision infrastructure, alter DNS, open firewall ports, migrate data or deploy production services.

External contact requires an explicit send instruction and confirmed recipient. Any order or paid commitment requires separate explicit financial approval. Production deployment and public DNS/MX changes require separate reviewed change plans and explicit authorization.

NODE01 remains a software/logical identity. Any compute host must be independently identified as a real physical or virtual execution resource.
