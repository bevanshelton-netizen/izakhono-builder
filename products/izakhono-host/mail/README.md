# IZAKHONO MAIL — owned mail service

This directory defines the owned-first mail runtime using Stalwart.

## Protocols

- SMTP: 25
- SMTPS: 465
- Submission: 587
- IMAP: 143
- IMAPS: 993
- HTTPS/WebUI/API: 443

Stalwart provides SMTP, IMAP, JMAP and the management interface in one server image. The deployment uses persistent `/etc/stalwart` and `/var/lib/stalwart` volumes.

## Activation

Activate Stalwart only through the authorized IZAKHONO Runtime Fabric execution adapter, using the existing HOST mail plane and the separately registered execution environment selected by Runtime Fabric.

NODE01 is the logical software-runtime identity and command-gateway route; it is not the execution host. Do not SSH to a presumed NODE01 machine, run this stack from a developer workstation or CI runner, or start a competing standalone mail stack. The gateway must first prove fresh adapter registration, a healthy execution-environment binding, the required runtime capabilities, tenant/workload/environment authorization from FORTRESS, and a correlated audit acknowledgement.

The execution adapter may run the owned HOST activation sequence documented in [NODE-DEPLOYMENT.md](../../../izakhono-mail/NODE-DEPLOYMENT.md) after the deployment gate is satisfied. Inject `STALWART_RECOVERY_ADMIN` and all other secrets from FORTRESS at execution time; never commit credentials or paste them into chat.

A compose configuration check or CI result is not a live activation receipt. If the registered executor or any authorization/evidence adapter is unavailable, activation must remain blocked.

## Mailbox provisioning

After initial setup, provision the domain and accounts through the Stalwart management API/CLI. Account passwords are customer secrets and must never be committed to Git.

## External delivery acceptance

`MAIL-ACCEPTANCE-REAL.sh` is a read-only DNS/TLS/network prerequisite probe. It does not prove message delivery.

`MAIL-ACCEPTANCE-E2E.py` performs the real three-way test:
1. external mailbox → Stalwart mailbox (inbound);
2. Stalwart mailbox → external mailbox (outbound);
3. external mailbox reply → Stalwart mailbox, with the reply's `In-Reply-To` checked against the outbound Message-ID.

Run the E2E probe only through the verified Runtime Fabric execution environment and its acceptance adapter. SMTP/IMAP credentials for both mailboxes must be injected from FORTRESS at execution time. Required settings are `IZAKHONO_MAIL_SMTP_HOST/USER/PASS`, `IZAKHONO_MAIL_IMAP_HOST`, `EXTERNAL_SMTP_HOST/USER/PASS`, and `EXTERNAL_IMAP_HOST`; ports, TLS modes and mailbox identities can be supplied through the corresponding `*_PORT`, `*_TLS_MODE`, `*_USER` and `*_EMAIL` settings. The probe never prints credentials.

Its JSON receipt records each verified direction, Message-ID and observation time. The Runtime Fabric acceptance adapter must persist that receipt and its authorization/audit correlation in FORTRESS. A probe result is not itself a production deployment or DNS promotion.

## Acceptance gate

A mailbox is not considered LIVE until all of these are independently verified:

1. MX resolves to the owned mail edge.
2. SPF, DKIM and DMARC are published and validated.
3. SMTP submission succeeds with authenticated TLS.
4. IMAPS login succeeds.
5. An external sender can deliver to the mailbox.
6. The mailbox can send to an external recipient.
7. The received message is visible through IMAP/JMAP.
8. TLS certificates validate for the public mail hostname.

Until those checks pass, status remains `PENDING`.
