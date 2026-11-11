# NODE01 Software Runtime — Execution Environment Activation Gate

## Purpose

This gate verifies a separately managed execution environment before it is bound to and permitted to execute IZAKHONO NODE01 software.

**NODE01 IS SOFTWARE. NODE01 IS NOT PHYSICAL INFRASTRUCTURE.**

The machine, VM, cloud instance or container host on which the software runs is an independently managed, replaceable execution environment. It must never be renamed or identified as NODE01.

## Required evidence

Run the approved preflight and activation procedures against the actual execution environment, using its real infrastructure locator:

```bash
./NODE-PREFLIGHT.sh
./NODE-ENVIRONMENT-ACTIVATE.sh
./NODE-COMPLIANCE.sh
```

The activation sequence must complete successfully and the owned runtime health endpoint must respond locally. Record the environment locator separately from the logical software identity in the runtime-binding record.

## Public acceptance evidence

Independently verify:

- public IPv4 reachability
- public IPv6 reachability where configured
- TCP 80/443 reachability
- DNS delegation and resolution
- trusted HTTPS certificate
- customer hostname resolution
- owned runtime content
- backup/restore readiness
- FORTRESS controls
- mail transport readiness before mailbox activation

## Promotion rule

No deployment is marked LIVE merely because the repository contains activation scripts, a software identity record, a container image, or a successful CI run. Promotion requires current execution-environment binding and independent machine-side and public-side evidence.

The binding must identify NODE01 as `software-runtime`, identify the execution environment using its own locator, and state `runtime_host_is_separate: true`. A missing or placeholder locator blocks execution.

## Customer handoff

Customer provisioning proceeds only after independent acceptance of content, DNS, HTTPS, mail transport and real mail delivery. No customer secrets, SMTP credentials, private keys or API tokens belong in this repository.
