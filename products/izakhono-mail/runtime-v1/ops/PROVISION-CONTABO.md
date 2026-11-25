# IZAKHONO MAIL — Owner-Controlled Hardware Provisioning

## Deployment decision

The first deployment target is an existing, IZAKHONO-controlled physical machine. IZAKHONO builds and operates the hosting platform and owns its service configuration, control plane, data, security policy and operational procedures.

**Zero-spend rule:** this runbook authorises no purchase, VPS, managed mailbox, paid service, subscription or other recurring charge. Do not create cloud compute or substitute a hosting provider. If the existing machine cannot meet a requirement, stop, document the measured gap and evaluate no-cost options. Any future spending decision requires a separate explicit owner approval after a written estimate.

A physical machine still depends on electricity and network connectivity. Those dependencies do not transfer ownership of the platform or its services to an infrastructure supplier.

## Canonical runtime

- Mail engine: Stalwart.
- Webmail: Roundcube.
- Public HTTP/HTTPS edge: the single canonical IZAKHONO HOST Caddy service.
- Mail domain: `izakhono.africa`.
- Initial mailboxes: `ceo`, `sales`, `info`, `support`, `finance` at `@izakhono.africa`.
- Stalwart administrative/JMAP interfaces remain private; ports 18080 and 18081 are loopback-only.

Do not deploy a second mail engine, public Caddy edge, Certbot renewal job or competing state store.

## Phase A — identify and inspect the existing machine

1. Confirm the machine is owned or explicitly controlled by IZAKHONO and identify its physical location and responsible operator.
2. Enrol the machine with the approved host-management agent. Enrollment connects to an existing machine; it does not create compute capacity.
3. Run `infra/owned-hardware/inspect-host.sh` from the repository on the machine, or perform an equivalent read-only inventory.
4. Record hostname, OS, CPU, RAM, storage layout and health, network interfaces, routes, listening sockets, firewall policy, container runtime, running workloads, power/UPS and backup arrangements.
5. Review resource headroom and existing workloads before proposing any installation. Do not run bootstrap scripts or alter services during discovery.

If host ownership, access authority, disk health or sufficient isolation cannot be established, stop.

## Phase B — prove network feasibility before deployment

Verify from the existing owner-controlled network:

- whether the machine has a stable, publicly reachable address;
- whether the connection is behind CGNAT or requires router port forwarding;
- whether inbound TCP 25, 465, 587, 993, 80 and 443 can be permitted safely;
- whether outbound TCP 25 is permitted by the ISP/network operator;
- whether the owner can set reverse DNS/PTR for the public mail address;
- whether the address has acceptable reputation and is not on relevant blocklists;
- whether firewall rules can restrict SSH and keep administrative interfaces private;
- whether power, cooling and physical access are sufficiently reliable;
- whether encrypted backups can be copied to a separate, owner-controlled failure domain.

Do not assume residential connectivity supports production mail. If SMTP port 25 or PTR control is unavailable, record mail delivery as blocked. Do not silently route around this by buying a VPS, using a hosted mailbox provider or substituting a transactional email service.

## Network contract (only after feasibility is proven)

Required inbound TCP services, subject to the approved firewall plan:

- 22 — owner SSH, restricted to approved source addresses or secure access path;
- 25 — SMTP server-to-server delivery;
- 465 — authenticated SMTP over TLS;
- 587 — authenticated SMTP submission with STARTTLS;
- 993 — IMAPS;
- 80/443 — the canonical HOST Caddy edge only.

Keep Stalwart administration and JMAP private. Do not expose ports 18080 or 18081 publicly. Do not open ports merely because they appear in this list; first document the host's actual topology, router, firewall and rollback procedure.

## Phase C — staged installation

Proceed only after Phases A and B pass and the host-specific change plan is reviewed:

1. Confirm the approved OS version, patch state, storage capacity, firewall baseline and recovery access.
2. Confirm Docker Engine and Compose availability. If absent, prepare an installation plan using official distribution instructions; do not install packages until the owner approves that specific host change.
3. Review the canonical `products/izakhono-host/docker-compose.owned.yml` and confirm the shared `izakhono-mail` network and port ownership.
4. Review the mail runtime configuration and preflight requirements. Back up any existing state before changes.
5. Set unique owner-held secrets in a local `.env`; never commit it or disclose its values in logs/evidence.
6. Run `bash ops/preflight.sh` before any bootstrap. Resolve every failure; do not bypass safety checks.
7. Deploy HOST edge and shared networking only through the approved change plan. Confirm it owns public ports 80/443.
8. Deploy the canonical Stalwart service and Roundcube using the repository's supported bootstrap path. The bootstrap must reuse the HOST Stalwart service and must refuse to start a second Stalwart container.
9. Perform first-run administration through a private access path, such as a loopback-only SSH tunnel.
10. Configure certificate issuance and renewal so Stalwart owns mail-domain certificate renewal and HOST Caddy owns webmail HTTPS. Do not add a second public edge or competing renewal process.

A script existing in the repository is not authorization to execute it on an unknown or production machine.

## DNS and mail identity contract

Do not publish or change public DNS during initial staging. First establish who controls the current authoritative zone and export the existing records.

After the mail host and network have passed acceptance, generate the exact DNS material from Stalwart. The following are required record roles, not values to guess:

- `mail.izakhono.africa` A/AAAA — verified public address of the approved mail host;
- `webmail.izakhono.africa` A/AAAA — address of the canonical HOST edge;
- `izakhono.africa` MX — points to the verified mail hostname;
- SPF — reflects the actual authorized outbound mail path;
- DKIM — exact selector and public key generated by Stalwart;
- DMARC — initially monitored, then tightened after legitimate senders are inventoried and alignment is proven;
- PTR/rDNS — set by the network/address authority to the verified mail hostname.

Never guess a DKIM selector, key, public IP, MX target or PTR value. Never replace an existing DNS zone before exporting and validating all A/AAAA/CNAME/MX/TXT/SRV/CAA/NS and verification records.

## Provisioning identities and secrets

The initial identities are:

- ceo@izakhono.africa
- sales@izakhono.africa
- info@izakhono.africa
- support@izakhono.africa
- finance@izakhono.africa

Create mailboxes only after domain and DNS ownership are verified and the public mail path is accepted. Use the restricted provisioner role from `config/stalwart-provisioner-role.json`, a dedicated service account and an Inherit-mode API key. Never place System Administrator credentials in the application environment.

Never commit `.env`, mailbox passwords, Stalwart administrator credentials, DKIM private keys, TLS private keys, database passwords, age identities or backup decryption keys. Mailbox passwords are returned once by the provisioner and must not be stored in evidence files.

## Acceptance gate

Production remains BLOCKED until all of the following pass with timestamped evidence tied to the actual host:

- verified host ownership, authorization and capacity;
- public A/AAAA, MX, SPF, DKIM and DMARC records;
- correct PTR/rDNS and forward-confirmed hostname;
- independently verified reachability of TCP 25/465/587/993;
- valid SMTP and IMAP TLS certificates;
- authenticated SMTP submission;
- outbound delivery to an independent external mailbox;
- inbound delivery from an independent external mailbox;
- reply path, IMAPS login and Roundcube login;
- DKIM signature validation and DMARC alignment;
- encrypted backup creation;
- verified encrypted copy in a separate owner-controlled failure domain;
- successful restore and post-restore mail delivery;
- FORTRESS access controls, audit trail and rollback proof.

If the current ISP/network cannot satisfy mail requirements, mail production is blocked. Do not relabel a forwarding service or external relay as IZAKHONO-owned mailbox hosting.

A running container, created mailbox, successful CI run or local SMTP test is not proof of public mail delivery.

## Recovery and host migration

1. Create an encrypted backup using the owner-controlled age recipient.
2. Copy the encrypted artifact and checksum to separate owner-controlled storage and verify the checksum.
3. Prepare the replacement owner-controlled machine and repeat the host/network acceptance gates.
4. Restore using the matching age identity; keep runtime secrets separate from backup data.
5. Reapply public DNS/PTR only after the replacement host passes preflight and the owner approves a reviewed change plan.
6. Run the full mail acceptance gate.
7. Move traffic only after inbound/outbound delivery and restore integrity have been proven.

The machine and network are execution dependencies. IZAKHONO owns the mail runtime, provisioning logic, DNS intent, security policy, customer experience and evidence contract.
