# IZAKHONO OWNED HOSTING PLATFORM — Foundation v1

**Status:** Architecture foundation; implementation and production activation remain separately gated.  
**Owner:** IZAKHONO  
**Repository:** `bevanshelton-netizen/izakhono-builder`  
**Date:** 25 November 2026

## 1. Platform mandate

IZAKHONO will build and operate its own hosting platform. The platform is the system of record for customer domains, websites, certificates, DNS zones, mail domains and mailboxes, storage, databases, backups, usage and service health.

IZAKHONO owns the control plane, service definitions, automation, data model, security policy, operational evidence and customer experience. Physical compute, network transit, power and upstream connectivity may initially be purchased from infrastructure suppliers. Those suppliers provide raw capacity; they do not become the hosting platform or the system of record.

The platform must not depend on Vercel as its production web or mail runtime. Cloudflare may remain a transitional registrar/DNS/security adapter for domains where it is already configured, but it is not the long-term authoritative DNS runtime for the sovereign DNS service.

## 2. Architectural principles

1. **Owned control plane:** tenant, domain, site, mail, storage, deployment, billing and evidence records live in IZAKHONO-controlled services and databases.
2. **Provider-neutral infrastructure adapters:** compute, DNS delegation, object storage, payment and network suppliers are replaceable adapters with explicit contracts.
3. **Separate control and data planes:** management APIs do not proxy arbitrary shell commands; workloads run in isolated, typed runtime environments.
4. **One canonical service per responsibility:** no parallel mail engines, public HTTP edges, schedulers or competing state stores.
5. **Security by default:** least privilege, short-lived credentials, explicit owner approval for privileged operations, tenant isolation, audit trails, encrypted secrets and recoverable backups.
6. **Evidence before status:** a service is not LIVE because a process starts or a deployment API returns success. Current external acceptance evidence is required.
7. **No silent cutovers:** DNS, registrar delegation, MX, production data migrations and traffic changes require reviewed plans, owner authorization and rollback evidence.
8. **Cost control:** no compute, storage, domain, network or provider purchase is initiated without an explicit cost estimate and approval.

## 3. Logical architecture

```text
Customers / IZAKHONO operators
             |
      HOST customer portal
             |
  HOST API + FORTRESS authorization
             |
    IZAKHONO HOST control plane
             |
  typed jobs / provisioner / scheduler
             |
  +----------+-----------+-----------+-----------+
  |          |           |           |           |
  DNS       WEB         MAIL        DATA       BACKUP
  |          |           |           |           |
PowerDNS   Caddy      Stalwart    PostgreSQL   encrypted
primary/   native     Roundcube   MinIO        snapshots
secondary  runtimes   SMTP/IMAP   Valkey       offsite copy
  |          |           |           |           |
  +----------+-----------+-----------+-----------+
             |
       owned node cluster
             |
  compute / network / storage suppliers
       (replaceable capacity only)
```

FORTRESS remains the policy and identity authority. NODE01/Runtime Fabric remains the orchestration and workload-state layer where already defined by the repository architecture. HOST owns the customer hosting domain and its typed provisioning workflows. The physical execution host is a separately identified and approved machine; logical NODE identities are not physical servers.

## 4. Platform service planes

### 4.1 HOST control plane

Canonical product: `products/izakhono-host`.

Responsibilities:
- tenant, project, domain and service inventory;
- typed provisioning and lifecycle jobs;
- site and deployment state;
- certificate admission and acceptance evidence;
- customer-facing service status;
- integration with FORTRESS authorization and existing Runtime Fabric/NODE01 boundaries.

The control plane must not expose arbitrary infrastructure shell execution to customer-facing APIs.

### 4.2 Web hosting plane

Canonical public edge: HOST Caddy. Native site runtime and persistent customer document roots are the owned web runtime. DNS points customer hostnames to the owned edge. TLS issuance is admitted only for provisioned hostnames and verified DNS.

Acceptance requires external DNS resolution, HTTPS certificate validation, expected content, health checks, persistence across restart and successful backup/restore.

### 4.3 Mail hosting plane

Canonical mail engine: Stalwart. Canonical webmail: Roundcube. HOST Caddy remains the only public HTTP/HTTPS edge. SMTP/IMAP are exposed only on the documented mail ports; administrative/JMAP interfaces remain private.

The existing mail implementation is tracked in PR #695 and related mail work. It is not production-live merely because its source is present. The implementation must be reconciled and reviewed before deployment.

Initial IZAKHONO mail identities:
- ceo@izakhono.africa
- sales@izakhono.africa
- info@izakhono.africa
- support@izakhono.africa
- finance@izakhono.africa

Mailbox provisioning is blocked until the exact domain is verified and public MX, SPF, DKIM and DMARC records are validated. Each mailbox must pass external inbound, outbound, reply, IMAPS, webmail and backup/restore tests before it can be labelled LIVE.

### 4.4 Authoritative DNS plane

Canonical owned DNS implementation: PowerDNS Authoritative with PostgreSQL-backed zones, controlled API, primary/secondary replication, DNSSEC capability and health monitoring.

Cloudflare may be used as a transitional DNS/registrar adapter while existing domains remain there. It must not be confused with IZAKHONO-operated authoritative nameservers. Sovereign DNS is not complete until at least two independently reachable authoritative servers are deployed, parent delegation and glue are correct, SOA/NS answers are authoritative and consistent, and UDP/TCP 53 plus DNSSEC are independently verified.

Never replace an existing zone before exporting and validating all A/AAAA/CNAME/MX/TXT/SRV/CAA/NS records, including verification, SPF, DKIM and DMARC records.

### 4.5 Data and object storage

PostgreSQL is the transactional database baseline. MinIO is the owned object-storage baseline. Valkey provides cache/queue primitives where appropriate. Every service must declare its owner, schema/migration authority, backup policy, restore procedure, retention and tenant-isolation model.

### 4.6 Backup and recovery

Backups must be encrypted, integrity-checked and copied to a separately controlled location. A backup is not accepted until a restore has been performed into an isolated target and the restored service passes functional checks. The primary host and its attached disk are not an offsite backup.

## 5. Node and environment model

Separate environments:
- development;
- CI/test;
- staging/acceptance;
- production.

Separate logical roles:
- CONTROL;
- EDGE;
- DNS primary;
- DNS secondary;
- WEB runtime;
- MAIL;
- DATA;
- BACKUP;
- SECURITY/FORTRESS.

Roles may initially share a physical machine only where resource, isolation and failure-domain analysis permits. DNS primary/secondary must ultimately occupy distinct network/failure domains. Mail and web workloads must not expose their administrative control surfaces publicly.

Every physical host requires a verified hostname, owner, location/failure domain, OS, capacity, public/private addressing, firewall policy, storage layout, monitoring, backup coverage and authorized execution identity before activation.

## 6. Delivery sequence

### Phase 0 — source and ownership reconciliation
- Review existing HOST, mail, authoritative DNS, Runtime Fabric, FORTRESS and NODE01 implementations.
- Select one canonical implementation for each responsibility.
- Record unresolved owners, interfaces, migrations, security decisions and operational dependencies.
- Keep existing PRs separate; do not merge or deploy by assumption.

### Phase 1 — owned foundation
- Finalize HOST control-plane service contracts and tenant/domain/site/mail inventory.
- Establish host enrollment, secure operator access, monitoring and audit.
- Validate the existing physical host and available capacity.
- Produce an infrastructure bill of materials and cost estimate before any purchase.

### Phase 2 — staging cluster
- Provision only after owner approval.
- Deploy control, edge, DNS, data, storage and backup services in staging.
- Establish encrypted offsite backup and perform restore drills.
- Validate isolation, firewall policy, service recovery and observability.

### Phase 3 — first owned web service
- Publish a controlled test domain/site.
- Verify DNS, TLS, content, persistence, logging and recovery from external networks.
- Complete rollback rehearsal before customer traffic.

### Phase 4 — owned mail service
- Deploy Stalwart and Roundcube on the approved owned host.
- Verify public mail DNS, PTR, port reachability, TLS and reputation.
- Provision the five IZAKHONO mailboxes only after DNS gates pass.
- Complete inbound, outbound, reply, IMAP, webmail and restore tests.

### Phase 5 — sovereign DNS and multi-node resilience
- Deploy at least two authoritative PowerDNS nodes in independent failure domains.
- Import zones and validate records before registrar delegation changes.
- Enable DNSSEC only after end-to-end DS/DNSKEY validation.
- Test node loss, failover, replication and restore.

### Phase 6 — customer hosting platform
- Expose approved domain, website, mail, storage and database products through HOST.
- Add quotas, metering, plans, billing and support workflows only after reliable service telemetry and cost accounting exist.
- Add customer onboarding and self-service without granting customers infrastructure-level privileges.

## 7. Production acceptance gates

No service is production-live until its service-specific tests pass and evidence is recorded with timestamp, target identity, software revision and test result.

Common gates:
- verified host ownership and authorized access;
- patched OS, firewall and least-privilege service identities;
- current monitoring and alert delivery;
- encrypted backup and successful restore;
- documented incident and rollback procedures;
- no exposed admin interfaces or committed secrets;
- tenant isolation and audit evidence;
- externally verified DNS and TLS;
- resource headroom and capacity plan.

Mail-specific gates are defined in `products/izakhono-host/mail/README.md` and `products/izakhono-mail/runtime-v1/DEPLOYMENT-STATUS.md`.

DNS-specific gates are defined in `infra/authoritative-dns/README.md`.

## 8. Current evidence and blockers (25 November 2026)

Verified from repository source:
- HOST owned-runtime architecture and Compose baseline exist on the mail-hosting implementation branch.
- HOST documentation describes native web runtime, Caddy edge, CoreDNS baseline, PostgreSQL, MinIO and Valkey.
- Stalwart/Roundcube mail integration and mailbox/DNS acceptance gates are implemented in the open PR #695 branch.
- PowerDNS authoritative DNS architecture and deployment gates are documented in `infra/authoritative-dns/README.md`.
- The mail deployment status file explicitly reports runtime NOT PROVISIONED, public DNS NOT VERIFIED and send/receive NOT VERIFIED.

Not verified operationally:
- an enrolled, authorized production host;
- current capacity and public IP/PTR;
- active authoritative DNS deployment or registrar delegation;
- production database ownership and migration authority;
- live HOST or mail containers;
- public MX/SPF/DKIM/DMARC;
- end-to-end mail delivery;
- encrypted offsite backup and successful restore.

The SentinelX account currently reports zero enrolled hosts and zero connected integrations. Therefore no server-side inspection, provisioning or deployment can be truthfully claimed from this session.

## 9. Immediate execution queue

1. Reconcile PR #695 against current `main` and existing HOST/mail implementations; resolve its non-mergeable state before considering integration.
2. Identify and enroll the existing IZAKHONO-controlled Linux host; inspect it read-only first.
3. Connect the authorized DNS/registrar account through a secure integration flow; never paste credentials into chat.
4. Confirm whether `izakhono.africa` is registered, who controls its authoritative DNS and what records currently exist.
5. Produce a host-specific deployment plan and cost estimate; obtain explicit approval before any paid compute or storage.
6. Deploy staging first, then run independent acceptance tests before any production traffic or MX cutover.

## 10. Non-goals and prohibited shortcuts

- Do not treat Cloudflare Email Routing as a full mailbox server.
- Do not treat Gmail SMTP relay or a transactional email API as owned mail hosting.
- Do not deploy production web or mail runtime to Vercel.
- Do not purchase compute or incur recurring charges without explicit approval.
- Do not change registrar delegation, public DNS, MX, production data or firewall exposure without a reviewed change plan and authorization.
- Do not mark a service LIVE based on source code, CI success, a running process or a successful control-plane response alone.
