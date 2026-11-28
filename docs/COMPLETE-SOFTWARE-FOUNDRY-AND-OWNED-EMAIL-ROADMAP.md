# IZAKHONO Complete Software Foundry and Owned Services Blueprint

**Status:** Architecture and implementation roadmap  
**Cost approval:** R0. No subscriptions, servers, domains, paid APIs, or upgrades are authorised by this plan.  
**North star:** Build, deploy, host, secure, operate, and recover our own digital products and customer services—including our own domain-based email.

## 1. Mission

IZAKHONO must become a complete, modular software foundry and service platform. It must be capable of creating and operating websites, web applications, APIs, SaaS products, business systems, databases, automation, AI-assisted workflows, digital publishing systems, and communications services.

This is a capability target, not a claim that every component is already implemented or production-ready. Existing repositories and applications must be audited and reused before new systems are written.

## 2. The capability map

### A. Build and engineering factory
- Web front ends: React, Next.js, Vue, Svelte, Angular, Astro and static sites.
- Back ends and APIs: Node.js/TypeScript, Python, Go, PHP and other Docker-compatible runtimes where practical.
- Mobile/PWA delivery and API-first services.
- Reusable templates, component libraries, design system, code generation, build pipelines and release management.
- Git hosting/mirrors, issue tracking, package/dependency management, CI tests, artefact registry and software bill of materials.
- Development, test, staging and production environments with reproducible builds.

### B. Application hosting and runtime
- Linux host operating system and container runtime.
- Reverse proxy, ingress, TLS and routing.
- Container isolation, resource quotas, health checks, autoscaling policy and deployment rollback.
- Background workers, scheduled jobs, queues and event processing.
- Multi-tenant isolation, per-customer configuration and usage metering.
- Portable deployment targets: local development, compatible managed app platforms, and eventually IZAKHONO-owned nodes.

### C. Data services
- PostgreSQL as the primary relational database.
- Redis/Valkey for cache, ephemeral coordination and queue workloads where appropriate.
- S3-compatible object storage for uploads, media, archives and generated files.
- Search and indexing, vector search where justified, analytics and reporting.
- Automated backup, point-in-time recovery where supported, off-site copies, restore drills and retention policy.
- Tenant-aware access control, encryption, schema migrations and data export.

### D. Identity, security and trust — FORTRESS
- Identity provider, MFA, session management, RBAC/ABAC and service identities.
- Secrets management, key rotation, encryption in transit and at rest.
- WAF/reverse-proxy protections, rate limits, abuse detection, vulnerability management and audit logging.
- Secure software supply chain, dependency scanning, signed artefacts and least privilege.
- Central monitoring, alerting, incident response and evidence retention.
- Privacy controls, retention schedules, data-subject workflows and POPIA-aware operational processes.
- Security must be designed into each plane, not added as a decorative dashboard.

### E. Domains, DNS and edge
- Domain inventory, registrar abstraction and renewal monitoring.
- Authoritative DNS, zone management, DNSSEC where operationally supported, and change audit.
- Reverse DNS/PTR coordination with the IP provider.
- Reverse proxy, load balancing, TLS certificate issuance/renewal and domain verification.
- Keep registrar ownership and DNS zone exports independent of any one hosting provider.

### F. IZAKHONO EMAIL — first-class owned service
We must be able to create and host addresses such as `person@ourdomain.example` on domains we control, with mailbox administration and standards-based sending/receiving.

Required capabilities:
1. Domain and mail-domain onboarding.
2. Mailbox creation, suspension, deletion, quotas and password/MFA policy.
3. Aliases, distribution lists, catch-all policy (disabled by default), forwarding and autoresponders.
4. SMTP submission with authenticated users; inbound SMTP reception.
5. IMAP access and optional POP3 only if required.
6. Browser-based webmail and mobile/desktop mail-client compatibility.
7. TLS certificates and secure transport.
8. SPF, DKIM and DMARC configuration and reporting.
9. Spam filtering, greylisting/rate controls, malware scanning and outbound abuse prevention.
10. Queue visibility, delivery logs, bounce handling, retry controls and operational alerts.
11. Mailbox and configuration backup, restore, retention and migration tools.
12. Admin API and customer-facing email control panel.

Candidate open-source building blocks to evaluate:
- Postfix: SMTP transfer and submission.
- Dovecot: IMAP, mailbox storage and authentication integration.
- Rspamd: spam filtering, policy, SPF/DKIM/DMARC-related processing and reputation controls.
- Roundcube: browser webmail.
- ClamAV: optional malware scanning, subject to resource and update planning.
- OpenDKIM or Rspamd DKIM signing: select one coherent signing approach rather than duplicating responsibility.
- Sieve: user mailbox filtering rules.
- PostgreSQL or another carefully selected directory backend for domains, users, aliases and policy.
- Prometheus-compatible metrics and central log collection.

These are candidate components, not a final installation decision. Select and pin versions after compatibility, security, resource and maintenance review. Keep mail data on durable storage and isolate the mail plane from ordinary web application workloads.

### Critical email hosting constraints

A managed app platform such as HCode is suitable for many web apps and APIs, but must **not** be assumed to support a complete mail server. A real mail service needs durable queues and storage, long-running daemons, inbound/outbound SMTP connectivity (especially TCP 25), authenticated submission, IMAP connectivity, reverse DNS/PTR, static IP reputation, DNS control, abuse handling and provider permission for mail traffic.

HCode's Dockerfile support means it can run many application containers; it does not establish that it supports public SMTP/IMAP ports, arbitrary network services, custom reverse DNS, persistent mail queues, or the operational controls required for production email. Therefore:
- Use HCode for the email administration portal, provisioning API, reporting UI or other ordinary web components only if its platform constraints fit.
- Run the actual SMTP/IMAP/mail storage plane on a host/network explicitly approved for mail, with required ports, static IP and PTR control.
- Do not route mail through HCode or promise hosted email until these requirements are confirmed.
- Do not send bulk marketing mail from customer mailbox infrastructure. Separate transactional and marketing delivery, with consent, unsubscribe and abuse controls.

### G. Business and customer services
- Multi-tenant customer portal, onboarding, billing integration, support, documentation and status pages.
- Website factory, CMS, e-commerce, booking, CRM, workflow automation, analytics and reporting.
- Subscription, licence, reseller and white-label management.
- Customer data export, account closure and service portability.

### H. AI and automation
- Model/provider abstraction and optional self-hosted model runtime when hardware permits.
- Retrieval/search, document processing, OCR, translation and content workflows.
- Tool execution in isolated sandboxes with permission boundaries.
- Human approval gates for financial, legal, compliance, customer-impacting and destructive actions.
- Usage budgets, audit trail and fallback behaviour.

## 3. Plane separation

Keep the platform modular and independently recoverable:

1. **Source plane:** repositories, code review, CI, package/artefact registry.
2. **Control plane:** tenants, users, projects, domains, billing, provisioning jobs and audit.
3. **Build plane:** reproducible builds, tests, scans and signed artefacts.
4. **Runtime plane:** isolated applications, APIs and workers.
5. **Data plane:** relational database, cache, queues and object storage.
6. **Edge plane:** DNS, ingress, reverse proxy and TLS.
7. **Mail plane:** SMTP, IMAP, webmail, mailbox storage, filtering and reputation.
8. **Security plane:** FORTRESS identity, secrets, policy, monitoring and incident response.
9. **Recovery plane:** independent backups, restore testing, disaster recovery and portability.

A failure in the website runtime must not destroy mailboxes, DNS zones, source repositories or backups.

## 4. HCode's place

HCode is an optional South African application-hosting adapter. It can be evaluated for ordinary web apps, APIs, background workers and supported Dockerfile workloads. It is not our source of truth, owned infrastructure, mail transport network, authoritative DNS service, or complete hosting control plane.

Use HCode only after an explicitly approved paid plan and a non-critical pilot. Current authorised spend remains R0. Keep every app deployable elsewhere.

## 5. Implementation roadmap — no-cost preparation first

### Phase 0 — Inventory and proof
- Inventory all existing IZAKHONO repositories, products, deployment targets and shared components.
- Mark each capability as: existing and verified; existing but unverified; missing; or blocked by external infrastructure.
- Identify duplicated services and consolidate only after dependency review.
- Run existing tests and capture reproducible evidence.
- No new product development until reuse opportunities are clear.

### Phase 1 — Software foundry
- Standardise repository layout, Dockerfile conventions, environment configuration and health checks.
- Create reusable application templates for web, API, worker and scheduled job.
- Create a portable build/test/release pipeline.
- Add software inventory, dependency/security scanning and deployment manifests.
- Build a provider-neutral deployment adapter interface.

### Phase 2 — Owned runtime foundation
- Validate existing IZAKHONO HOST control plane, edge, DNS, PostgreSQL, MinIO, Valkey, backup and restore implementations.
- Add isolated development profiles and deterministic local test environments.
- Add resource limits, non-root execution, secrets checks and preflight gates.
- Test backup and restore with disposable data.
- Do not expose public services until a real host and security gates exist.

### Phase 3 — Email laboratory
- Build a non-public mail lab using test domains/data and isolated containers.
- Verify mailbox provisioning, SMTP submission, IMAP access, webmail, TLS, SPF/DKIM/DMARC generation, spam controls, logging, queue recovery, backup and restore.
- Test both inbound and outbound flows in a controlled environment.
- Document exact DNS records and external prerequisites.
- Do not claim deliverability or production readiness from a local lab.

### Phase 4 — Revenue-funded pilot
- Choose one low-risk website/app for an optional HCode pilot only after written cost approval.
- Separately choose an email pilot only when a suitable mail host, static IP, PTR, ports, DNS and provider permission are secured.
- Use test users and non-sensitive data until acceptance tests pass.
- Keep an exit plan and independently held backups.

### Phase 5 — Owned production platform
- Activate physical or dedicated nodes only when revenue can support reliable compute, storage, network, redundancy, backups and support.
- Establish independent DNS, app runtime, database, object storage and mail infrastructure.
- Perform security review, load tests, restore drills, monitoring and incident exercises.
- Promote services individually; never label the entire platform production-ready because one application works.

## 6. Mandatory acceptance gates

No component is called production-ready until:
- A repeatable deployment is demonstrated.
- Authentication and tenant isolation are tested.
- Secrets are not present in source or logs.
- TLS and network exposure are verified.
- Monitoring and alerting work.
- Backups have been restored successfully in a test.
- Resource limits and failure modes are understood.
- Security and privacy controls are reviewed.
- Data export and migration are demonstrated.
- Rollback and incident procedures are documented.

Email has additional gates: external inbound and outbound tests, valid SPF/DKIM/DMARC, PTR alignment, TLS, queue persistence, spam/abuse controls, reputation monitoring, bounce handling and provider approval.

## 7. Financial and truth controls

- Current authorised infrastructure spend: **R0**.
- Do not order HCode, cloud, VPS, domains, IP addresses, mail services, hardware or paid APIs without explicit approval.
- Prefer existing free resources for development and test.
- Do not store real customer data in disposable labs.
- Never claim that a service is live merely because code or a Compose file exists.
- Distinguish architecture designed, code implemented, locally tested, deployed to staging, and production accepted.

## 8. Definition of success

IZAKHONO can create a new application from a reusable template, build and test it, deploy it to a selected portable runtime, attach a customer domain, provision its data services, apply FORTRESS security controls, monitor it, back it up, restore it, and migrate it.

Separately, IZAKHONO can onboard a mail domain, create and manage mailboxes, send and receive authenticated email, provide webmail and IMAP access, filter abuse, maintain DNS authentication, and recover mailbox data.

**Build the capability once. Reuse it across products. Own the code and the customer relationship. Keep every deployment portable. Let revenue finance production infrastructure.**
