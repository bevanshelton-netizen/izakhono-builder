# NODE01 Software Runtime — Execution Environment Activation Gate

## Purpose

This gate verifies a separately managed execution environment before it is bound to and permitted to execute IZAKHONO NODE01 software.

**NODE01 IS SOFTWARE. NODE01 IS NOT PHYSICAL INFRASTRUCTURE.**

The machine, VM, cloud instance or container host on which the software runs is an independently managed, replaceable execution environment. It must never be renamed or identified as NODE01.

## Required evidence and procedure status

The execution-environment locator must be obtained from the authorised infrastructure owner and recorded separately from the logical software identity.

**Repository procedure now exists:** `NODE-ENVIRONMENT-ACTIVATE.sh` provides three explicit modes: `--preflight` runs only the local read-only inventory; `--verify-approval` verifies a detached owner signature and the signed NODE01/host/source-revision binding without activation; `--activate` requires root, a root-owned signed approval record, an active approved self-hosted runner service, read-only inventory and an exact interactive confirmation before it invokes `NODE01-ACTIVATE.sh`.

The owner private key is never stored in Git. The public key, approval JSON and detached signature must be installed by the authorised owner outside the repository (default paths under `/etc/izakhono`). The signed record binds the logical NODE01 software identity to a separate environment locator, expected hostname, exact Git revision, runner identity/labels, approving operator, change reference, rollback and backup/restore references, allowed action and a maximum 24-hour approval window. The procedure does not register a runner or independently query GitHub; runner registration is owner-attested and the local systemd service must be active. The procedure has not been run against a production host.

The existing `NODE01-ACTIVATE.sh` is not a read-only preflight. It invokes `NODE-PREFLIGHT.sh`, then `bootstrap-owned.sh`, then `NODE-COMPLIANCE.sh`, and finally checks the local health endpoint. The bootstrap can generate local secrets, build images and start services. Therefore, do not run `NODE01-ACTIVATE.sh` to discover host identity, test access, or establish readiness.

A repository-side candidate read-only inventory script is provided at `NODE01-READONLY-PREFLIGHT.sh`. Review its exact contents and obtain the infrastructure owner's approval before running it on any host. It inventories local system facts and local container-client/version availability only. It deliberately does not contact the Docker daemon: a configured remote Docker context or `DOCKER_HOST` could otherwise create a network connection. It does not perform network probes, writes, builds, starts, secret generation or configuration changes. Daemon connectivity and network checks require a separate authorised procedure. Its output is discovery evidence only. Activation commands must be reviewed for their exact side effects and separately approved for the identified environment.

## Runtime binding evidence

The reviewed runtime-binding record must identify NODE01 as `software-runtime`, identify the actual execution environment using its own locator, and state `runtime_host_is_separate: true`. It must also record runner identity and registration/health evidence, deployment revision and timestamp, and the approving operator/change reference. Do not use a placeholder locator or equate the replaceable machine with the NODE01 software identity.

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

Also verify runtime/service health, security controls and tenant isolation, persistent storage, and rollback readiness. A local health check alone is not sufficient evidence of public production readiness.

## Promotion rule

No deployment is marked LIVE merely because the repository contains activation scripts, a software identity record, a container image, or a successful CI run. Promotion requires current execution-environment binding and independent machine-side and public-side evidence.

DNS cutover and customer LIVE status require separate explicit approval after all applicable acceptance evidence passes.

## Customer handoff

Customer provisioning proceeds only after independent acceptance of content, DNS, HTTPS, mail transport and real mail delivery. No customer secrets, SMTP credentials, private keys or API tokens belong in this repository.
