# NODE01 Physical Activation Gate

## Purpose

This gate is the final machine-side prerequisite before an IZAKHONO-owned node can be promoted as a public production execution target.

## Required evidence

Run on the actual NODE01 machine:

```bash
cd products/izakhono-host
./NODE-PREFLIGHT.sh
./NODE01-ACTIVATE.sh
./NODE-COMPLIANCE.sh
```

The activation sequence must complete successfully and the owned runtime health endpoint must respond locally.

## Public acceptance evidence

After machine activation, independently verify:

- public IPv4 reachability
- public IPv6 reachability where configured
- TCP 80/443 reachability
- TCP and UDP 53 reachability
- authoritative DNS delegation
- trusted HTTPS certificate
- customer hostname resolution
- owned runtime content
- backup/restore readiness
- FORTRESS controls
- mail transport readiness before mailbox activation

## Promotion rule

No node is marked `LIVE` merely because the repository contains activation scripts, a node record, a Docker image, or a successful CI run. Promotion requires current machine-side and public-side evidence.

## XQWAXQWAMILÉ handoff

Once NODE01 passes this gate, the XQWAXQWAMILÉ customer record can proceed through:

`PROVISION → CONTENT → DNS → HTTPS → ACCEPT → MAIL TRANSPORT → REAL MAIL TEST → MAILBOX/MX ACCEPTANCE → HANDOVER`

No customer secrets, SMTP credentials, private keys, or API tokens belong in this repository.
