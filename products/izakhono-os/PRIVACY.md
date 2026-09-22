# IZAKHONO OS Privacy Standard

## Rule 1: No tracking

IZAKHONO OS does not track the user.

The operating system must not collect, transmit or monetize behavioural usage data for advertising, profiling or product analytics.

## Prohibited by default

- telemetry
- advertising IDs
- behavioural analytics
- cross-app tracking
- hidden identifiers
- silent crash-report uploads
- third-party analytics SDKs
- tracking pixels
- background audience measurement
- sale or sharing of user activity for advertising

## Network transparency

A network connection is permitted only when it is required for an explicit feature such as:
- user-requested web browsing
- software installation
- security updates
- firmware updates
- user-configured cloud sync
- user-configured email or messaging

Every IZAKHONO-owned network service must be documented in a human-readable network ledger with:
- destination
- purpose
- data category
- whether it is optional
- how the user can disable it

## AI privacy

Ask IZAKHONO must prefer on-device processing for private system tasks.

If a cloud model is ever used:
- the user must be told before content leaves the device
- the request must require explicit consent
- the destination must be identified
- no background prompt logging may be added by IZAKHONO
- sensitive local files must not be uploaded without explicit per-action approval

## Diagnostics

Diagnostics must be local-first. Exporting a diagnostic bundle is a user action.

Automatic crash submission is disabled by default.

## Enforcement

A release must fail privacy review if:
- a new analytics dependency is introduced
- an undocumented network endpoint appears
- telemetry is enabled
- tracking identifiers are added
- privacy controls are not accessible from Easy Center

This standard applies to all IZAKHONO OS builds.
