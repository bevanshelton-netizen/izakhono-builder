# IZAKHONO MAIL — owned mail service

Project ID: IZK-INF-MAIL-001
Portfolio: IZAKHONO Infrastructure
Runtime: Stalwart + Roundcube + IZAKHONO Mail Control Plane

This is the self-hosted mail service. Stalwart owns transport and mailbox storage; Roundcube provides browser webmail; the IZAKHONO Mail Control Plane performs authenticated domain/mailbox provisioning and secure one-time password handover.

## Service endpoints

- Mail and Stalwart account/admin interface: https://mail.izakhonoafrica.co.za
- User webmail: https://webmail.izakhonoafrica.co.za
- Owner-only Mail Control Centre: https://mail-admin.izakhonoafrica.co.za
- Autoconfiguration: autoconfig.izakhonoafrica.co.za
- Autodiscovery: autodiscover.izakhonoafrica.co.za
- MTA-STS policy: https://mta-sts.izakhonoafrica.co.za/.well-known/mta-sts.txt
- Local-only mail control-plane readiness: http://127.0.0.1:8082/api/ready

The Mail Control Centre is protected by Caddy Basic Auth. Its generated owner password is stored in mail/secrets/mail_admin_password; do not send it by email. The console is currently read-only and reports missing delivery, authentication, backup and incident telemetry as not connected. These are intended endpoints, not a claim that DNS, certificates or delivery are already live. Public DNS and external acceptance tests must pass first.

## Protocols

- SMTP inbound: TCP 25
- Authenticated SMTP submission: TCP 465 (implicit TLS) and 587 (STARTTLS, if enabled in Stalwart)
- IMAP: TCP 143 (STARTTLS, if enabled)
- IMAPS: TCP 993
- POP3 / POP3S: TCP 110 / 995, if enabled
- ManageSieve: TCP 4190
- HTTPS/JMAP/WebUI: public TCP 443 through Caddy
- Stalwart HTTP listener: container port 8080, private network only; host binding defaults to loopback

Do not publish Stalwart's HTTP management listener or bootstrap wizard directly to the internet. Caddy terminates public TLS and proxies the mail hostname to the private Stalwart HTTP listener. The direct HTTPS listener is bound to host loopback for local recovery only.

## Initial corporate mail identities

- Human corporate mailbox: bevans@izakhonoafrica.co.za
- Dedicated application sender: notifications@izakhonoafrica.co.za
- Reporting mailbox: dmarc-reports@izakhonoafrica.co.za

The application sender must not reuse the CEO's human mailbox credentials. Other mailboxes in the portfolio manifest remain pending until each domain is verified and approved.

## Activation on the owner-controlled machine

The physical execution machine is ISN-01. NODE01 is the logical software-node identity and is activated on an approved execution host.

1. Complete the ISN-01 Docker and host preflight.
2. Copy the host environment template to products/izakhono-host/.env and populate unique secrets in a protected secrets store.
3. Create the two Roundcube secret files described in mail/secrets/README.md.
4. Run the host activation and Stalwart activation scripts from products/izakhono-host.
5. Verify the host, mail bridge, Stalwart, mail control plane and Roundcube containers are healthy.
6. Do not publish MX changes yet.

Set MAIL_MODE=local for a co-located service; STALWART-ACTIVATE.sh starts both the host and local Stalwart stacks. Set MAIL_MODE=remote when using a dedicated mail node; run MAIL-NODE-ACTIVATE.sh on that node first, then run STALWART-ACTIVATE.sh on the host. The host-side SMTP_HOST, STALWART_API_URL, STALWART_HTTP_UPSTREAM and MAIL_NODE_PRIVATE_IP must point to the verified private VPN endpoint; the mail-node MAIL_NODE_BIND_IP must bind only to its private VPN interface. Container-to-mail-node routing must be tested from the host stack. Port 8080 must remain private.

## Domain ownership and mailbox provisioning

The mail control plane is internal-only and requires a separate bearer token. The only initially approved provisioning domain is izakhonoafrica.co.za.

1. Request a domain verification challenge through POST /api/domains/verification.
2. Publish the exact TXT record returned by the API at _izakhono-verify.izakhonoafrica.co.za.
3. Wait for DNS propagation and call POST /api/domains/verify.
4. The API refuses domain and mailbox creation until ownership is verified.
5. Run ./MAIL-CONTROL-PLANE-VERIFY.sh request, publish the returned TXT challenge, then run ./MAIL-CONTROL-PLANE-VERIFY.sh verify.
6. Create a mailbox with ./MAILBOX-PROVISION.sh <local-part> "<display name>". The one-time handover token is stored in a protected, Git-ignored file under mail/handover/.
7. Deliver the handover token out-of-band. The mailbox owner runs ./MAILBOX-ACTIVATE.sh <email-address> <handover-json-file> and chooses a new password. The token is one-time and expires.
8. Log in through Roundcube at webmail.izakhonoafrica.co.za and verify IMAP/SMTP.
9. Create notifications@izakhonoafrica.co.za separately. Set SMTP_PASS in the host .env to the exact password chosen during that mailbox's activation, then restart mail-bridge.

The Stalwart management API token, control-plane token, handover encryption key, SMTP password and Roundcube secrets are separate credentials. Never put them in source control, browser JavaScript, email drafts or customer-visible logs.

## DNS and deliverability

Use DNS-RECORDS-IZAKHONOAFRICA.md as a staged worksheet. Required records include:

- A records for mail, webmail and mta-sts to the verified static public IP.
- MX pointing to mail.izakhonoafrica.co.za.
- Autoconfig/autodiscover aliases.
- SPF merged with every legitimate existing sender; do not replace the current provider's SPF blindly.
- DKIM using the exact public key and selector generated by the live Stalwart instance.
- DMARC initially at p=none with aggregate reporting.
- MTA-STS TXT and HTTPS policy file, initially in testing mode.
- TLS-RPT TXT.
- Reverse DNS/PTR from the IP provider to mail.izakhonoafrica.co.za.

A static public IP, inbound/outbound TCP 25, PTR control and stable DNS are hard prerequisites for production SMTP. A WSL2 NAT address or HTTP tunnel alone is not a production mail edge.

## Edition and tenant boundary

This deployment uses Stalwart Community as the transport engine. IZAKHONO's own internal control plane is the only administrative layer and must enforce tenant/domain authorization before calling Stalwart. Do not expose the Stalwart super-admin token or give customers direct server administration.

Stalwart's native delegated multi-tenant administration is an Enterprise feature. If customer-specific delegated tenant administrators are required, either obtain the appropriate Enterprise licence or deploy isolated Stalwart instances per customer. Do not promise native Stalwart tenant isolation on Community edition.

## Backups and migration

Mail data and configuration must be included in encrypted off-host backups and tested restore drills. Do not treat a local tarball or an untested export as a verified backup.

- Configure Restic using .backup.env.example and initialize the repository once.
- Run ../backup-owned.sh for the host runtime, Roundcube database, mail-control-plane state, Caddy, MinIO and Valkey.
- Run ./backup-mail-node.sh for Stalwart configuration and mailbox data. This takes the mail service offline briefly for a consistent snapshot.
- Use ../restore-owned.sh <snapshot-id> for host recovery.
- Use ./restore-mail-node.sh <snapshot-id> for Stalwart recovery.

For a dedicated remote mail node, keep a separate mail/.backup.env on that node and run the mail backup/restore scripts there. Keep the Restic repository password and object-store credentials separate from the server's runtime secrets.

The restore process must preserve mailbox data, indexes, DKIM keys, server configuration, Roundcube database and one-time handover state. Run a restore drill before treating backups as verified.

Keep the current Hostinger service and MX records active during testing. Migrate existing mail and verify send/receive with independent providers before cutover. Retain a documented rollback path.

## Acceptance gate

A mailbox is not LIVE until all of these are independently verified:

1. Domain ownership TXT verification succeeds.
2. MX, A/AAAA, PTR, SPF, DKIM, DMARC, MTA-STS and TLS-RPT records are correct.
3. SMTP inbound port 25 is reachable from an independent external network.
4. Authenticated SMTP submission succeeds with valid TLS.
5. IMAPS login succeeds.
6. An external sender can deliver to the mailbox.
7. The mailbox can send to an external recipient.
8. The message is visible through IMAP/JMAP and Roundcube.
9. TLS certificates validate for mail, webmail and MTA-STS hostnames.
10. Backups and a restore drill succeed.
11. Rate limits, abuse controls, mailbox quotas, monitoring and alerting are verified.

Until every required gate passes, the status remains PENDING. Do not change MX or claim the email service is live.
