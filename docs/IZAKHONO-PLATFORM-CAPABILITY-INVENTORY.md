# IZAKHONO Portfolio Capability Inventory — Repository Audit

**Audit date:** 28 November 2026  
**Scope:** Eight repositories visible through the connected GitHub account, with a deeper path/documentation audit of `izakhono-builder`.  
**Purpose:** Reuse and complete existing software before commissioning duplicate systems.  
**Important:** A repository, source file, workflow, green CI job or deployment definition is not proof of a live production service.

## 1. Executive result

The portfolio is not starting from zero. The main `izakhono-builder` repository contains 4,217 tracked tree entries on the audited branch, extensive application and infrastructure code, multiple CI workflows, a native Builder, HOST runtime definitions, provisioning systems, FORTRESS-related controls and a substantial email implementation.

The largest immediate risk is not simply missing software. It is **fragmentation, duplicated/legacy implementations, stale readiness evidence, unclear canonical ownership and incomplete real-world acceptance**. The next programme must consolidate and verify existing assets before adding more code.

## 2. Repositories visible in the connected GitHub account

| Repository | Visibility | README evidence / known scope | Audit note |
|---|---|---|---|
| `izakhono-builder` | Public | Native software Builder, HOST, provisioning, mail, control-plane and shared platform code | Main engineering and infrastructure repository; deeper audit performed |
| `allegro-vibez` | Public | Music, creator, Artist OS and ALLEGRO Live platform | README explicitly distinguishes implemented foundations from future integrations |
| `edubuild-ecd360` | Private | ECD centre, family, finance, safeguarding and enterprise platform | README says pre-production pending full container, health, rehearsal and owned-infrastructure gates |
| `SHELTON-FORTRESS` | Private | FORTRESS endpoint and business trust/security platform | README describes Alpha objectives and remaining real-world device evidence |
| `the-chancellor` | Public | Business Growth Desk, adviser, audit, portal, dashboard and PayFast integration | README says JSON store is single-server only; live payment mode must remain gated until full validation |
| `bevanshelton-netizen-legacymart` | Public | LegacyMart multi-seller marketplace foundation | Payouts blocked until gateway, KYC/KYB, refunds, disputes, settlement and accounting are verified |
| `nextradefinx` | Public | Multilingual AI financial-market education and paper-trading platform | README explicitly says repository setup is on security hold until visibility is confirmed Private |
| `Downloads` | Public | Repository description: AI PLATFORM | No root README was found in this audit; contents and intended ownership require separate review |

This is the set returned by the connected GitHub repository listing at audit time; it is not a claim that no other code exists in other accounts, organisations, Vercel projects or Supabase projects.

## 3. Main IZAKHONO Builder capability evidence

The audited tree contains dedicated implementation areas and workflows for:
- Native Builder, website/application generation and reusable visual engine.
- Software NODE identity, orchestration, build, test, evidence and deployment.
- IZAKHONO HOST, reverse proxy/edge, authoritative DNS, data services and deployment.
- Provisioner, job queues, adapter contracts, recovery, reconciliation and audit.
- FORTRESS security, identity/access and policy controls.
- IZAKHONO MAIL, mail identity registry, mail-processing engine, runtime, webmail and control centre.
- Payments, finance, subscriptions, marketing, CRM, creator workflows, document processing, analytics and AI runtime.
- Dedicated GitHub Actions workflows for Builder, HOST, DNS, mail, FORTRESS, provisioner, creator and product-specific validations.

These are **repository capability indicators**, not a completed certification of every module. Each product still needs a scoped implementation and operational status.

## 4. Email audit — important finding

### 4.1 Canonical runtime selected in the repository

The current runtime-v1 documentation selects:
- **Stalwart** for SMTP, submission, IMAP, JMAP, domain/mailbox directory, DKIM and ACME certificate management.
- **Roundcube** for browser webmail.
- **MariaDB** for Roundcube session/preferences data only.
- **IZAKHONO HOST Caddy edge** as the only public HTTP/HTTPS edge.
- **IZAKHONO Provisioner** with a restricted Stalwart JMAP service account for mailbox provisioning after DNS verification.

The previous Docker Mailserver (DMS) definition is explicitly superseded. Do not operate DMS and Stalwart as parallel production engines for the same domain. Postfix/Dovecot/Rspamd are generic architectural alternatives, not the selected canonical runtime.

### 4.2 Existing software found

- Mail identity and portfolio mailbox manifests.
- Native mail API, mailbox provisioning, authentication and DNS-control modules.
- Stalwart JMAP adapter and tests.
- SMTP inbound prototype and private-domain mailbox/webmail lab.
- Shared mail-processing, queue, worker, delivery-event, DKIM and policy modules.
- NODE01/owned mail readiness probes and production acceptance checks.
- Stalwart + Roundcube runtime-v1 Compose stack.
- Preflight, provider acceptance, health, encrypted backup and restore scripts.
- Mail Control Centre API/UI and contract tests.
- Dedicated mail CI workflows and KORA mail release/acceptance workflows.

### 4.3 Current recorded deployment status

The repository's `products/izakhono-mail/runtime-v1/DEPLOYMENT-STATUS.md` records:
- Build: READY.
- Runtime: NOT PROVISIONED.
- Public DNS: NOT VERIFIED.
- Send/receive: NOT VERIFIED.
- Initial IZAKHONO mailboxes defined in source: CEO, Sales, Info, Support and Finance.
- Those mailboxes are **not provisioned**.

Therefore the codebase contains a substantial email product and deployment package, but it does not yet prove that a working public mailbox exists.

### 4.4 Production prerequisites still outstanding

The runtime requires an owner-approved Linux/Docker host and:
- Static public IPv4 (IPv6 recommended).
- Provider permission and real reachability for inbound/outbound TCP 25.
- TCP 465, 587 and 993.
- Shared HOST edge on 80/443.
- PTR/rDNS aligned with the mail hostname.
- Domain ownership and correct A/MX/SPF/DKIM/DMARC records.
- Valid TLS, authenticated SMTP submission and IMAPS.
- External send, receive and reply acceptance.
- Encrypted backup copied off-host and a verified restore.
- FORTRESS access, audit, abuse and incident controls.

HCode is not accepted as the mail runtime merely because it supports Dockerfile builds. Its support for the required public SMTP/IMAP ports, PTR/rDNS, persistent queues and mail-provider policy must be explicitly established; until then it is an app-hosting candidate only.

### 4.5 Reconciliation issues

The repository contains older mail registries and evidence that refer to `izakhonoafrica.co.za`, while the canonical runtime-v1 documentation and initial mailbox configuration target `izakhono.africa`. Some legacy readiness evidence is dated September/October 2026. Treat it as historical until re-probed.

Do not copy legacy domain readiness into the canonical runtime or enable a sender based on stale evidence. Reconcile the source-of-truth domain list, legal ownership, DNS delegation and current registry status before changing any public DNS or provisioning a mailbox.

## 5. Consolidation decisions

1. **One canonical mail engine:** Stalwart + Roundcube under IZAKHONO HOST. Keep private mail-core prototypes and legacy transports as test/adapters only; no parallel production engines.
2. **One authoritative identity source:** select and reconcile the canonical portfolio mailbox manifest and domain registry. Remove drift only after comparing all consuming applications.
3. **One provisioning route:** Provisioner → verified DNS → restricted Stalwart JMAP account → mailbox → acceptance evidence.
4. **One shared public edge:** HOST Caddy owns public HTTP/HTTPS; do not start competing public proxies in mail Compose files.
5. **One evidence-based status model:** DESIGNED → BUILT → LOCALLY TESTED → STAGING VERIFIED → LIVE VERIFIED. Never skip a gate.
6. **Portable provider boundary:** HCode may host supported web control-plane components; mail runtime needs a mail-capable host/network.
7. **No paid activation:** current authorised infrastructure spend remains R0. No host, HCode plan, domain, IP or paid service may be ordered without explicit approval.

## 6. Implementation order

### Stage 1 — Source-of-truth and inventory
- Reconcile the main portfolio repository and the separate product repositories.
- Identify canonical implementations, legacy duplicates and provider-specific adapters.
- Record each component's owner, repository, entry point, tests, deployment target, secrets, data stores and external dependencies.
- Confirm private/public visibility and secret hygiene; specifically resolve the NexTradeFinX security hold and review the Downloads repository.

### Stage 2 — Software verification
- Run the unified mail validation, Builder/Provisioner/HOST/FORTRESS checks and each product's own CI.
- Fix missing scripts and broken workflow triggers.
- Record actual CI run IDs, commit SHAs and test output.
- Do not claim a green suite until GitHub Actions reports success.

### Stage 3 — Runtime lab
- Use only existing/free development resources and synthetic data.
- Validate the canonical Stalwart + Roundcube Compose configuration.
- Exercise mailbox create, authenticate, send, receive, reply, alias, quota, disable and restore flows in an isolated lab.
- Test DNS generation and readiness gates without mutating public DNS.

### Stage 4 — Revenue-funded production activation
- Only after explicit spending approval, choose a host with documented mail permission, static IP, PTR and required port reachability.
- Provision the host and DNS under owner control.
- Complete external acceptance and backup restore.
- Activate the first approved mailbox set only after all gates pass.

## 7. Status language

| Status | Meaning |
|---|---|
| DESIGNED | Architecture or specification exists |
| BUILT | Code/configuration exists |
| LOCALLY TESTED | Local automated tests pass |
| STAGING VERIFIED | Deployed to a controlled staging target and acceptance checks pass |
| LIVE VERIFIED | Real public endpoint and end-to-end operational evidence pass |

A green CI result is evidence of tested software, not evidence of public hosting, DNS, mail deliverability, backup restoration or production operations.

## 8. Immediate conclusion

We already own a significant body of software. The mission now is to turn it into a coherent, tested, deployable system—not to keep starting new projects.

The complete capability objective remains: build anything, deploy it, host it, secure it with FORTRESS, connect its data and domains, give it professional email identities where appropriate, monitor it, back it up, restore it and migrate it without losing ownership.

**Revenue-first. Reuse-first. Owned-first. Evidence always.**
