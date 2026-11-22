# IZAKHONO Zero-Purchase Owned Runtime Standard

**Decision:** Build and operate IZAKHONO's software infrastructure using already-available, owner-controlled execution capacity. No VPS, cloud server, hosting package, paid cluster, or hardware purchase is authorised by this standard.

## Ownership boundary

- NODE01–NODE04 are portable IZAKHONO software runtime identities, not physical machines.
- HOST is the owner-controlled provisioning and operations control plane.
- A runtime identity is bound to an existing approved execution environment through the runtime-binding contract.
- The execution environment may be an already-owned computer, server, VM, or existing private infrastructure. It must be inventoried and security-assessed before use.
- A development workstation or a laptop that sleeps, moves networks, or lacks reliable power/connectivity is not automatically production-grade.

## Owned software stack

Use the existing repository implementations as the starting point:

| Capability | IZAKHONO-owned component |
|---|---|
| Provisioning and tenant control | IZAKHONO HOST control plane |
| Runtime identity and release | Runtime Fabric + immutable signed releases |
| Edge and HTTPS | Caddy configuration managed by IZAKHONO |
| DNS | CoreDNS zones and control-plane automation |
| Application/data | PostgreSQL |
| Object/file storage | MinIO |
| Cache/queues | Valkey |
| Security and policy | FORTRESS controls, least privilege, audit evidence |
| Backup and recovery | encrypted, integrity-checked backups and restore rehearsal |
| Build and release | IZAKHONO CODE / FORGE and CI evidence |

Open-source components are replaceable implementation dependencies; IZAKHONO owns the architecture, configuration, control plane, release process, operational policy, and customer-facing service.

## Execution sequence

1. On the existing owner-controlled IZAKHONO HOST replacement, run the read-only inventory: `bash infra/owned-runtime/host-inventory.sh`. It reports OS, architecture, CPU, RAM, storage, network addresses, listening sockets and Docker/K3s availability; it does not change the machine or collect secrets. Share only its JSON output for capacity assessment.
2. Inventory storage, network, power/UPS and internet connectivity. Record actual capacity; do not assume it exists.
3. Select an existing host only after OS, patching, disk, memory, network, firewall, remote administration, and recovery checks pass.
4. Run HOST preflight and the owned-runtime bootstrap in an isolated validation environment first.
5. Deploy NODE01 software identity to the approved existing execution environment; preserve the separation between node ID and host ID.
6. Verify application health, release identity, TLS, DNS, backups, restore, access controls, and rollback.
7. Add NODE02–NODE04 as independently available execution capacity when existing approved capacity is identified and validated.
8. Promote public traffic only after the owned public-cutover gates pass. Keep any already-verified public route intact until a controlled cutover is proven.

## Non-negotiable controls

- No purchase, subscription, paid provisioning, or chargeable resource creation without a separate explicit owner approval.
- No public exposure of databases, admin interfaces, or container control sockets.
- No secrets in Git, build logs, browser bundles, or ChatGPT.
- No public DNS delegation to a single unverified endpoint.
- No claim of OWNED LIVE VERIFIED based on repository files, CI, a local health check, or a configured-but-unreachable host.
- No production cutover until backup/restore and rollback are demonstrated.
- No deletion or shutdown of existing production services as part of the ownership transition.

## Current activation status

This document establishes the zero-purchase implementation policy. It does not assert that an existing physical execution host, public network route, authoritative DNS delegation, or production runtime has already been verified. Those require real inventory and live evidence.
