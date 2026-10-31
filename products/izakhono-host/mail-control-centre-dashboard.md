# IZAKHONO MAIL CONTROL CENTRE — DASHBOARD V1

## Purpose

The executive Mail Control Centre is the operational view over all IZAKHONO-managed business email. It consumes the provider-neutral Mail Control API and shows service health, security, delivery and infrastructure state without exposing mailbox content by default.

## Navigation

- Overview
- Domains
- Mailboxes
- Incidents
- Delivery
- Authentication
- Backups
- Infrastructure
- Audit

## Overview cards

1. Managed domains
2. Verified domains
3. Domains requiring attention
4. Active mailboxes
5. Suspended mailboxes
6. Open critical/high security alerts
7. Delivery health
8. Backup health

A card is informational only unless its underlying evidence is current. The dashboard must not infer production readiness from configuration.

## Domain table

Columns:

- Domain
- Platform
- Status
- MX
- SPF
- DKIM
- DMARC
- TLS
- SMTP
- IMAP
- Backup
- FORTRESS
- Monitoring
- Transport
- Last verified
- Open incidents

Filters:

- Status
- Platform
- Owned / external fallback
- Failed checks
- Open incidents

## Mailbox table

Columns:

- Address
- Platform
- Status
- Storage
- Last authentication
- Last successful delivery
- Delivery failures
- Security status
- Backup status

Mailbox message content is not displayed in this dashboard.

## Incident panel

Every incident shows:

- Severity
- Domain/mailbox
- Event type
- Status
- Created time
- Resolution time
- Correlation ID
- Recommended operator action

Critical and high incidents remain visually prominent until acknowledged/resolved.

## Infrastructure panel

Show:

- Mail runtime provider
- Owned / external-fallback state
- Software NODE assignment
- Node heartbeat
- SMTP service
- IMAP service
- DNS verification
- TLS state
- Backup state
- FORTRESS state
- Monitoring state

The provider label must come from verified evidence. A configuration value alone cannot establish ownership.

## Operator controls

Owner and Mail Administrator may access configuration actions permitted by RBAC. Security Administrator controls security/FORTRESS actions. Support Administrator receives limited operational controls. Auditor is read-only.

Destructive actions require confirmation and create an audit event before completion.

## Production badge rules

Allowed states:

- CONFIGURED
- DEGRADED
- VERIFIED
- FAILED

Never display LIVE or PRODUCTION-READY unless the domain readiness contract has passed all required checks and there are no blocking incidents.

## Responsive behavior

The dashboard must work on desktop, tablet and mobile. Critical health and security information must remain visible without requiring horizontal scrolling.

## API boundary

The dashboard must consume the Mail Control API rather than reading infrastructure state directly. This preserves provider neutrality and allows IZAKHONO MAIL to migrate between Software NODEs or approved external fallback transports without changing the executive interface.
