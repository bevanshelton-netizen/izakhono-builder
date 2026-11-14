# IZAKHONO MAIL CONTROL CENTRE — V1

## Purpose

The Mail Control Centre is the owner-facing operational console for IZAKHONO-managed business email. It is served by the IZAKHONO HOST Caddy edge and reads live domain/mailbox inventory from the private IZAKHONO Mail Control Plane.

## V1 implementation status

Implemented in this repository:

- Owner-only HTTPS hostname: mail-admin.izakhonoafrica.co.za.
- Caddy Basic Auth protects the console; the generated password is stored in the ignored local file mail/secrets/mail_admin_password.
- Caddy injects the server-side control-plane bearer token. The browser never receives the token.
- Read-only GET /api/control-centre endpoint queries Stalwart domain and account inventory.
- Live DNS checks for MX, SPF, DKIM, DMARC, MTA-STS and TLS-RPT.
- Live endpoint checks for SMTP port 25, SMTP submission TLS, IMAPS TLS and MTA-STS policy availability.
- Mailbox state reflects Stalwart enabled/emailSend permissions.
- Unknown delivery, authentication, backup, incident and FORTRESS telemetry is explicitly reported as not connected or pending, never as a false zero.
- The dashboard refreshes data on demand and labels its last update.

This V1 is an owner-only, read-only operations view. It is not a customer self-service portal and does not yet implement role-based customer access or privileged mailbox actions.

## Dashboard fields

### Executive view

- Total managed domains
- Verified domains
- Domains requiring attention
- Total mailboxes
- Active mailboxes
- Suspended mailboxes
- Security alerts — shown as not connected until an incident source is integrated

### Domain view

- Domain name
- Platform/tenant
- Status: configured / verified / degraded
- Mail transport
- Ownership verification
- MX, SPF, DKIM, DMARC, MTA-STS, MTA-STS policy, TLS-RPT
- SMTP, submission TLS and IMAPS TLS
- Backup, FORTRESS and monitoring status
- Last verification timestamp

A domain is only shown as verified after ownership verification and all required public mail checks pass. Configuration alone is not health evidence.

### Mailbox view

- Address
- Platform
- Status
- Storage usage, when exposed by Stalwart
- Security monitoring status
- Backup status

Mailbox content is not exposed in the executive dashboard. Content access, where legally and operationally required, is a separately permissioned and audited administrative function.

## Telemetry not yet integrated

The following are future integrations and must not be represented as operational until connected and tested:

- Successful and failed delivery events
- Authentication history and anomaly detection
- Quota and storage telemetry
- Incident and alert feed
- Backup snapshot verification and restore evidence
- FORTRESS security events
- Node heartbeat and observability integration
- Provider failover status

## Future administrative capabilities

The following are planned but are not available as V1 dashboard actions:

- Provision, suspend, restore and delete mailboxes
- Reset and rotate credentials
- Create/delete aliases
- Assign mailbox policies and quotas
- Run delivery diagnostics
- Trigger and restore approved backups
- Move workloads between eligible infrastructure adapters
- Escalate security events to FORTRESS

These actions require role-based authorization, audit logging, explicit confirmation for destructive operations and tenant-isolation tests before release.

## Security model

V1 uses a generated owner-only Basic Auth credential at the Caddy edge and a server-side control-plane token injected by Caddy. The control-plane API is not exposed directly to the public internet.

Future roles:

- Owner — full infrastructure oversight
- Mail Administrator — mail configuration and mailbox operations
- Security Administrator — security events and FORTRESS integration
- Support Administrator — customer support actions without unrestricted content access
- Auditor — read-only evidence and event history

Every future privileged action must record actor, timestamp, tenant/domain, action, target, result, correlation/request ID and relevant evidence.

## Provisioning flow

The current operator workflow is:

```text
CREATE VERIFICATION CHALLENGE
    ↓
PUBLISH DOMAIN TXT
    ↓
VERIFY DOMAIN OWNERSHIP
    ↓
CREATE MAILBOX THROUGH CONTROL PLANE
    ↓
ONE-TIME HANDOVER
    ↓
OWNER SETS PASSWORD
    ↓
TEST WEBMAIL / IMAP / SMTP
    ↓
PUBLISH AND VERIFY AUTHENTICATION DNS
    ↓
EXTERNAL SEND/RECEIVE TESTS
    ↓
ACCEPTANCE EVIDENCE
```

Automated registrar/DNS-provider integration, customer self-service onboarding, billing and production failover remain future work.

## Approved domain scope

The initial provisioning allowlist contains only:

- IZAKHONO AFRICA — izakhonoafrica.co.za

Edu-Build, Allegro Vibez, KORA Network and other portfolio domains are not approved for mailbox provisioning until each domain is explicitly added to the allowlist and independently verified. A portfolio plan is not a live mail tenant.

## Non-negotiable rule

The control centre may report **configured**, **verified**, **degraded**, **pending**, **failed**, or **not connected**. It must never report **live**, **owned**, or **production-ready** without the corresponding evidence contract being satisfied.
