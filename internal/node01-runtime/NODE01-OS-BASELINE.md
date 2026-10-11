# IZAKHONO NODE01 — OS Baseline

## Objective

NODE01 runs a hardened, supported Linux server distribution as the owned foundation for IZAKHONO compute.

## Baseline

- Current supported Ubuntu Server LTS or equivalent enterprise Linux release.
- UEFI boot with Secure Boot where hardware compatibility permits.
- TPM 2.0 enabled.
- Docker Engine + Docker Compose plugin from a trusted package source.
- SSH keys only for administration; password SSH disabled.
- Host firewall default deny; allow only required management, edge and workload ports.
- AppArmor or equivalent mandatory access controls enabled.
- Automatic security updates enabled with controlled reboot policy.
- NTP/time synchronisation enabled.
- Persistent journald with bounded disk usage.
- Log rotation enabled.
- BMC credentials separated from OS credentials.
- No secrets committed to Git.

## Host rules

1. The host is the security boundary; containers are not a substitute for host hardening.
2. The Docker socket is never mounted into the network-facing NODE01 control runtime.
3. The private registry is never exposed directly to the Internet.
4. Production workloads require health checks before route promotion.
5. Host storage, backup storage and registry storage must remain recoverable independently.
6. External hosting is an optional fallback, never the primary ownership model.

## Acceptance test

A NODE01 host is accepted only after:

- OS patching succeeds.
- Secure Boot/TPM state is recorded.
- Firewall rules are verified.
- SSH key authentication works and password authentication is disabled.
- Docker and Compose pass validation.
- Control runtime health is green.
- Private registry health is green.
- Backup creation succeeds.
- Restore verification succeeds.
- A controlled reboot returns all required services to healthy state.
