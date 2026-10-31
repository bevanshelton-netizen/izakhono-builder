# IZAKHONO MAIL CONTROL CENTRE — V1

## Purpose

The Mail Control Centre is the central operational console for all IZAKHONO-managed business email. It provides domain, mailbox, security, delivery, backup and infrastructure oversight from the IZAKHONO HOST control plane.

## Core dashboard

### Executive view

Display:

- Total managed domains
- Verified domains
- Domains requiring attention
- Total mailboxes
- Active mailboxes
- Suspended mailboxes
- Delivery health
- Authentication health
- Backup health
- Security alerts
- Mail infrastructure status

### Domain view

For each domain:

- Domain name
- Platform/tenant
- DNS status
- MX status
- SPF status
- DKIM status
- DMARC status
- TLS status
- Mail transport provider
- Ownership mode: owned / external fallback
- Last verification timestamp
- Open incidents

### Mailbox view

For each mailbox:

- Address
- Platform
- Status
- Storage usage
- Last authentication activity
- Last successful delivery
- Recent delivery failures
- Security status
- Backup status
- Assigned policies

Mailbox content is not exposed in the executive dashboard. Content access, where legally and operationally required, is a separately permissioned and audited administrative function.

## Alerts

Generate actionable alerts for:

- MX failure
- SPF failure
- DKIM failure
- DMARC failure
- TLS expiry or failure
- SMTP delivery degradation
- IMAP service degradation
- abnormal authentication activity
- excessive failed logins
- mailbox quota threshold
- backup failure
- node heartbeat failure
- mail-runtime outage
- external provider degradation

Severity levels:

- Critical — service/security impact requiring immediate action
- High — likely operational impact
- Medium — degradation or configuration drift
- Low — advisory

## Administrative actions

Authorized administrators may:

- Provision mailbox
- Suspend mailbox
- Restore mailbox
- Reset credentials
- Rotate credentials
- Create/delete aliases
- Assign mailbox policies
- Verify DNS
- Re-run DKIM generation
- Re-run DMARC/SPF checks
- Run delivery diagnostics
- Trigger backup
- Restore from approved backup
- Move mail workload between eligible infrastructure adapters
- Escalate security events to FORTRESS

Destructive actions require explicit confirmation and audit logging.

## Security model

The Mail Control Centre follows least privilege and role-based access control.

Roles:

- Owner — full infrastructure oversight
- Mail Administrator — mail configuration and mailbox operations
- Security Administrator — security events and FORTRESS integration
- Support Administrator — customer support actions without unrestricted content access
- Auditor — read-only evidence and event history

Every privileged action records:

- actor
- timestamp
- tenant/domain
- action
- target
- result
- correlation/request ID
- relevant evidence

## Monitoring integration

Mail health is consumed by the IZAKHONO observability layer. A mailbox/domain must not be labelled healthy from configuration alone; health requires current verification evidence.

## Infrastructure integration

The Mail Control Centre is provider-neutral. It can supervise:

- IZAKHONO MAIL on Software NODEs
- approved external mail adapters
- migration/failover states

External capacity remains reversible. The control plane owns policy and evidence even when an external transport provider is temporarily used.

## Provisioning flow

```text
CREATE TENANT
    ↓
VERIFY DOMAIN
    ↓
CONFIGURE DNS
    ↓
CREATE MAIL TENANT
    ↓
CREATE MAILBOXES / ALIASES
    ↓
SPF + DKIM + DMARC
    ↓
TLS
    ↓
SMTP / IMAP TEST
    ↓
BACKUP + FORTRESS
    ↓
MONITORING
    ↓
ACCEPTANCE EVIDENCE
    ↓
MAIL CONTROL CENTRE
```

## Platform coverage

The first registered platform set is:

- IZAKHONO Africa — `izakhonoafrica.co.za`
- Edu-Build — `edubuildshelton.org.za`
- Allegro Vibez — `allegrovibez.com`
- KORA Network — `streamkoraafrica.com`

Future platforms enter through the same domain-verification and acceptance workflow.

## Non-negotiable rule

The control centre may report **configured**, **degraded**, **verified**, or **failed**. It must never report **live**, **owned**, or **production-ready** without the corresponding evidence contract being satisfied.
