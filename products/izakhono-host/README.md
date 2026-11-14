# IZAKHONO HOST — owned-first hosting and email infrastructure

Project ID: IZK-INF-HOST-001
Division: IZAKHONO Infrastructure
Canonical platform: IZAKHONO HOSTING GATEWAY
Mail service: IZAKHONO MAIL (IZK-INF-MAIL-001)

## Physical host versus logical node

- **ISN-01** is the physical execution environment currently designated for the owner-controlled deployment (Windows 11 + WSL2 Ubuntu 24.04).
- **NODE01** is the logical software-node identity and role. It is not a physical computer.
- The same logical NODE01 services can later move to dedicated Linux servers without changing the platform's canonical identity.

## Purpose

This repository contains the owner-controlled hosting runtime and the IZAKHONO email infrastructure. The design is owned-first and externally reversible: IZAKHONO owns the control plane, provisioning rules, customer configuration, domain and service records, while replaceable compute, DNS, storage and delivery providers may be used underneath where necessary.

The platform is not considered production-live merely because its Docker containers start. Production status requires verified DNS, certificates, external reachability, mail delivery, backup recovery and tenant-security tests.

## Current implementation

### Hosting runtime

- Caddy edge proxy with on-demand TLS allowlisting.
- Native Node.js host runtime and internal control API.
- Host provisioning and health endpoints.
- PostgreSQL, MinIO, Valkey and CoreDNS services provisioned in the owned stack.
- Contact gateway and mail bridge.
- Supabase tenant tables with row-level security restricted to tenant ownership; browser-side direct writes are disabled.
- Persistent runtime and edge volumes.

The current native host runtime is an owned static-site hosting baseline, not yet a full commercial PaaS. The site registry and deployment history are currently stored in a durable JSON file on a persistent volume. The customer self-service portal, registrar/DNS-provider automation, tenant billing lifecycle, complete object-storage integration, dynamic PHP/application runtimes, database provisioning, usage metering and production multi-node failover still require implementation and verification. The current CoreDNS service is a local fixture/private test zone, not a delegated public authoritative DNS service; production DNS requires two independent public nameserver nodes, DNSSEC, registrar delegation and external resolver tests. Do not promise full Hostinger-equivalent hosting or one-click customer onboarding until those gates are complete.

### Email infrastructure

- Stalwart mail transport and mailbox storage.
- Roundcube browser webmail with a separate PostgreSQL database.
- Owner-only live Mail Control Centre at mail-admin.izakhonoafrica.co.za, protected by Caddy Basic Auth.
- Owner-only Hosting Control Centre at hosting-admin.izakhonoafrica.co.za, protected by a separate Caddy Basic Auth credential.
- Private IZAKHONO Mail Control Plane with approved-domain allowlist and DNS TXT ownership verification.
- One-time mailbox handover and password activation workflow.
- Separate human and application mail identities.
- Caddy HTTPS routes for mail, webmail, autoconfig, autodiscover and MTA-STS.
- SPF, DKIM, DMARC, MTA-STS, TLS-RPT and PTR acceptance checks.
- Separate encrypted Restic backup and restore workflows for host and Stalwart data.

Initial approved domain: izakhonoafrica.co.za.
Human mailbox target: bevans@izakhonoafrica.co.za.
Application sender target: notifications@izakhonoafrica.co.za.

Existing Hostinger mail must remain active until the IZAKHONO service passes independent send/receive tests and a controlled MX cutover is approved.

## ISN-01 bootstrap and NODE01 activation

Run these steps inside the Ubuntu WSL2 terminal on ISN-01:

1. From this directory, run ./infra/isn-01/ISN-01-BOOTSTRAP-WSL2.sh. It enables WSL2 systemd if required, installs Docker Engine and Compose, and installs operational tools.
2. If the script asks for a WSL restart, run wsl --shutdown from Windows PowerShell, reopen Ubuntu and rerun the bootstrap.
3. Close and reopen Ubuntu so Docker group membership takes effect.
4. Run ./NODE-PREFLIGHT.sh.
5. Run ./NODE01-ACTIVATE.sh.

NODE01-ACTIVATE.sh creates independent host secrets, creates protected Roundcube secrets, starts the host stack and starts the local or configured remote Stalwart mail service. It does not claim that the public mail service is live.

## Mail setup sequence

1. Configure a working TLS contact address and the owner-controlled host .env.
2. Open the local Stalwart setup interface in co-located mode at http://127.0.0.1:8080 or https://127.0.0.1:8443.
3. Create a dedicated least-privilege Stalwart API token and replace STALWART_API_KEY in .env.
4. Restart the mail-control-plane service and run ./mail/MAIL-CONTROL-PLANE-VERIFY.sh status.
5. Run ./mail/MAIL-CONTROL-PLANE-VERIFY.sh request; publish the exact TXT challenge; then run ./mail/MAIL-CONTROL-PLANE-VERIFY.sh verify.
6. Provision bevans and notifications using ./mail/MAILBOX-PROVISION.sh.
7. Activate each mailbox through ./mail/MAILBOX-ACTIVATE.sh. Store the chosen mailbox passwords in the owner's password manager.
8. Set SMTP_PASS to the notifications mailbox password and restart mail-bridge.
9. Complete the DNS worksheet and run ./mail/MAIL-ACCEPTANCE-REAL.sh.
10. Test inbound and outbound mail from independent external providers before any MX cutover.

See mail/README.md and mail/DNS-RECORDS-IZAKHONOAFRICA.md for the full mail runbook.

## Owner hosting operations

The owner-only hosting dashboard is served at https://hosting-admin.izakhonoafrica.co.za. Its generated Basic Auth password is stored in the ignored local file host/secrets/host_admin_password. It is read-only and reports actual provisioned sites and deployment records.

The initial runtime supports static websites (HTML, CSS, JavaScript, images, fonts and common static assets). Current deployment limits are 200 files, 512 KiB per file and 8 MiB total per deployment. Website content is uploaded as binary-safe base64 and switched atomically. Known secret files and private-key paths are blocked.

Operator commands, run from this directory:

```bash
./HOST-SITE-PROVISION.sh example.com
./HOST-SITE-DEPLOY.sh example.com /path/to/built-static-site
./HOST-SITE-ACCEPT.sh example.com
```

A deploy directory must contain index.html. The acceptance command does not trust caller-supplied booleans: the server checks the public A record against HOST_PUBLIC_IP, then performs an HTTPS request and content check. A site remains non-live unless all checks pass. WSL2 NAT or missing public routing will prevent acceptance; do not override that result.

The platform still needs customer authentication and self-service, automated registrar/DNS integration, billing, quotas, object storage, dynamic runtimes, database services, usage metering, backups for site content and multi-node failover before it can be sold as a full commercial hosting service.

## Backup and restore

- Copy .backup.env.example to .backup.env and configure an encrypted Restic repository.
- Run ./backup-owned.sh for the host runtime, Caddy, MinIO, Valkey, PostgreSQL, Roundcube and mail-control-plane state.
- Run ./mail/backup-mail-node.sh for Stalwart configuration and mailbox data. The Stalwart snapshot requires a short maintenance window.
- Use ./restore-owned.sh <snapshot-id> for host recovery.
- Use ./mail/restore-mail-node.sh <snapshot-id> for mail-server recovery.

A backup is not considered verified until a restore drill has completed successfully.

## WSL2 and public-edge limitation

WSL2 NAT is not automatically a production public hosting or email edge. Public websites and especially inbound SMTP require stable public routing, Windows/router port forwarding, firewall rules, a static public IP, provider-controlled PTR/reverse DNS, outbound TCP 25 permission and independent external tests.

If ISN-01 cannot satisfy those requirements, use a dedicated Linux mail/edge node under IZAKHONO's control and connect it over a private VPN. The service configuration supports local and remote mail modes; the private route itself must be tested from the Docker containers.

## Production release gates — not yet certified

- Physical ISN-01 Docker bootstrap has not been executed or verified in this repository workflow.
- Public static IP, PTR and inbound/outbound SMTP reachability have not been verified.
- Public DNS records and TLS certificates have not been verified.
- Stalwart API token, initial domain verification and mailbox activation remain owner-side setup steps.
- Real send/receive tests to independent providers remain outstanding.
- Restic credentials, off-host snapshots and restore drills remain outstanding.
- Customer self-service portal, tenant-aware provisioning, registrar/DNS automation and production multi-node failover remain outstanding.

Until these are completed, report the system as **implementation committed / deployment pending**, not live or production-ready.
