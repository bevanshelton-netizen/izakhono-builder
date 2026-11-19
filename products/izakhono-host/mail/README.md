# IZAKHONO MAIL — canonical Stalwart service

This directory defines the single Stalwart mail engine used by IZAKHONO HOST. Customer webmail is provided by Roundcube from products/izakhono-mail/runtime-v1. Public HTTP/HTTPS is owned by the shared HOST Caddy edge.

## Protocols and exposure

- SMTP server-to-server: TCP 25
- SMTPS: TCP 465
- Submission with STARTTLS: TCP 587
- IMAPS: TCP 993
- Stalwart HTTPS/admin: loopback-only host port 18080
- Stalwart bootstrap/JMAP HTTP: loopback-only host port 18081

Plaintext IMAP on TCP 143 is not published. Stalwart admin/JMAP listeners are not public. Webmail is routed by HOST EDGE at webmail.izakhonoafrica.co.za; mail.izakhonoafrica.co.za is used for SMTP/IMAP and the HTTP-01 ACME challenge only.

## Persistent data and shared network

The Stalwart service uses the existing named volumes:
- izakhono-mail-etc
- izakhono-mail-data

These names are shared with the SHELTON-FORTRESS mail runtime. Do not run the HOST and SHELTON-FORTRESS Stalwart Compose definitions at the same time. The runtime bootstrap checks for an existing Stalwart container and blocks rather than starting a second mail engine. Reconcile the active container, volume mounts and shared network before changing ownership of the service.

The service attaches to the shared izakhono-mail Docker network so HOST EDGE, Roundcube and the SMTP bridge can reach the same mail engine. It does not start a second Caddy instance.

## Activation

Deploy the owned HOST stack first. It creates the izakhono-mail network. Then use the runtime-v1 bootstrap procedure in products/izakhono-mail/runtime-v1.

The Stalwart recovery credential must be supplied through the protected runtime environment. Never commit it. Complete initial setup through the loopback-only bootstrap/admin listener using an SSH tunnel.

## Mailbox provisioning

Create the mail domain as owner administrator, configure DKIM and the ACME provider, and export the exact DNS zone material. The application uses a dedicated service account with a custom role and an Inherit-mode API key. The role includes the default User role plus only the required read/query/create permissions for domains and accounts. Do not give the application System Administrator credentials.

Mailbox creation is blocked until the Stalwart-generated MX/SPF/DKIM/DMARC intent is publicly verified. Passwords are generated once, returned to the owner-controlled secret channel, and never stored in evidence files.

## HOST SMTP bridge

The HOST mail bridge connects to the Stalwart hostname on port 587 using STARTTLS by default. SMTP_USER and SMTP_PASS must be a dedicated sending mailbox credential; never use the System Administrator or recovery account. Configure sender identities explicitly and verify Stalwart authorizes each From address before enabling contact-form or application sending.

The bridge reports smtp_configured=false until credentials are present. A healthy HTTP process alone does not prove outbound mail delivery.

## Acceptance gate

A mailbox is not LIVE until all of these are independently verified:

1. MX resolves to the owned mail edge.
2. SPF, DKIM and DMARC are published and validated.
3. SMTP submission succeeds with authenticated TLS.
4. IMAPS login succeeds.
5. An external sender can deliver to the mailbox.
6. The mailbox can send to an external recipient.
7. The received message is visible through IMAP/JMAP and Roundcube.
8. TLS certificates validate for the public mail hostname.
9. An encrypted backup restores successfully and post-restore delivery passes.

Until those checks pass, status remains PENDING.
