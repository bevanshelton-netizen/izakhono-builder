# NODE01 Software Runtime — Physical Execution Environment Activation Gate

## Purpose

This gate verifies the independently managed execution environment before it is bound to and permitted to execute IZAKHONO NODE01 software.

**NODE01 IS SOFTWARE. NODE01 IS NOT PHYSICAL INFRASTRUCTURE.**

The currently designated physical execution environment is **ISN-01** (Windows 11 with WSL2 Ubuntu 24.04). ISN-01 is the machine locator; NODE01 remains the logical software identity. A future dedicated Linux server or cloud instance may replace ISN-01 without renaming NODE01.

## Required local evidence

Run the approved procedures on ISN-01 from the Ubuntu WSL2 terminal:

```bash
./infra/isn-01/ISN-01-BOOTSTRAP-WSL2.sh
./NODE-PREFLIGHT.sh
./NODE01-ACTIVATE.sh
./NODE-COMPLIANCE.sh
```

If the bootstrap enables WSL2 systemd, restart WSL from Windows PowerShell with `wsl --shutdown`, reopen Ubuntu and rerun the bootstrap.

The activation sequence must complete successfully and the owned runtime health endpoint must respond locally. Record the physical environment locator separately from the logical software identity in the runtime-binding record.

## Public acceptance evidence

Independently verify:

- stable public IPv4 reachability and public IPv6 where configured
- TCP 80/443 reachability
- DNS delegation, A/AAAA, MX and service-host resolution
- reverse DNS/PTR for the mail public IP
- trusted HTTPS certificates for platform and mail hostnames
- SMTP inbound TCP 25 from an independent external network
- authenticated SMTP submission and IMAPS
- SPF, DKIM, DMARC, MTA-STS and TLS-RPT
- real inbound and outbound mail delivery to independent providers
- customer hostname resolution and correct owned runtime content
- encrypted off-host backup and successful restore drill
- FORTRESS controls and tenant-isolation tests

WSL2 NAT is not accepted as a production public mail edge without independent proof of stable routing, forwarding, firewall and provider support.

## Promotion rule

No deployment is marked LIVE merely because the repository contains activation scripts, a software identity record, a container image, or a successful CI run. Promotion requires current execution-environment binding and independent machine-side and public-side evidence.

The binding must identify NODE01 as `software-runtime`, identify ISN-01 using its physical environment locator, and state `runtime_host_is_separate: true`. A missing or placeholder locator blocks execution.

## Customer handoff

Customer provisioning proceeds only after independent acceptance of content, tenant isolation, DNS, HTTPS, mail transport and real mail delivery. No customer secrets, SMTP credentials, private keys or API tokens belong in this repository.
