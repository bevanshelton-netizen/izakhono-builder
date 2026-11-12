# IZAKHONO NODE CLUSTER v1

> **Runtime Fabric boundary (2 Nov 2026):** This directory describes an owner-controlled HA cluster implementation. **NODE01-NODE04 are logical software/runtime identities, not physical machines, servers, hostnames, or permanent hardware assignments.** Each logical identity is bound at runtime to an approved physical or virtual runtime host through `izakhono.runtime-binding/v1`. The cluster is not a prerequisite for public product availability and it must not make NODE01 a portfolio-wide launch gate.

This directory documents one implementation of the IZAKHONO runtime cluster beneath the logical node-identity layer. Products should first inherit the node-agnostic standard in `../runtime-fabric/README.md`.

## Logical identity and runtime-host boundary

| Logical identity | Preferred runtime role | Implementation role | Recovery principle |
| --- | --- | --- | --- |
| NODE01 | bootstrap/control-plane preference | k3s server/control-plane + worker | identity may rebind to an approved host |
| NODE02 | peer controller preference | k3s server/control-plane + worker | identity may rebind to an approved host |
| NODE03 | peer controller preference | k3s server/control-plane + worker | identity may rebind to an approved host |
| NODE04 | DR/workload preference | k3s worker + backup repository | identity may rebind to an approved host |

These are **software identities**. The underlying runtime host is separate infrastructure and may be physical, virtual, owned, or an approved external adapter. A host may change without changing the logical identity. No release, deployment, DNS, TLS, health, acceptance, or LIVE contract may bind the logical software identity to a permanent physical host.

NODE01 may be the preferred logical bootstrap role for this specific k3s implementation, but production applications must not depend on a particular NODE01 host being alive. Public launch/failover is governed by the Runtime Fabric, not by this cluster's bootstrap order.

The cluster uses three control-plane members (the logical NODE01-NODE03 roles) so control-plane quorum survives one controller failure. NODE04 remains outside the etcd voting set so it can act as a simpler disaster-recovery and workload role.

## Design goals

- owner-controlled Linux runtime
- no single-host dependency for the logical node identities
- encrypted Kubernetes secrets at rest
- encrypted pod network using WireGuard-native flannel
- automatic workload rescheduling after host failure
- scheduled etcd snapshots
- encrypted service/data backups
- explicit health proof before this cluster is called production-ready
- public traffic exposed only through IZAKHONO EDGE
- databases, admin panels and container ports remain private

## Cluster bootstrap order

This order is only for forming this k3s implementation. It must not be interpreted as assigning physical machines the names NODE01-NODE04:

1. Prepare the approved runtime hosts with static/reliable addressing, patched OS and SSH key access.
2. Copy and edit `cluster.env.example` outside source control, including the logical identity-to-host bindings.
3. Bind the preferred bootstrap logical identity to an approved runtime host using the runtime-binding contract.
4. Run the bootstrap role on that approved host.
5. Read the join token from the active control-plane host.
6. Bind the peer logical identities to approved runtime hosts and join them according to their assigned cluster roles.
7. Run `verify-cluster.sh` from an authorized admin host with cluster credentials.
8. Configure encrypted backups and run `backup.sh`.

Product releases do not wait for this procedure if another Runtime Fabric target is already healthy.

## Production proof for this cluster

- all required logical node identities are bound to approved runtime hosts
- the corresponding runtime hosts are independently verified and reachable
- logical NODE01-NODE03 control-plane quorum is healthy
- logical NODE04 workload/DR role is healthy
- encrypted backup and restore rehearsal succeed
- each controller role is failed individually during controlled tests
- replicated/stateless service remains available
- public edge routing is externally tested
- power-loss/recovery behaviour is tested on the actual runtime hosts
- secrets are not stored in GitHub or application images

## Important boundary

This repository builds cluster software and operating procedures. It cannot prove runtime hosts, LAN, UPS, public routing or disk durability until the actual infrastructure is installed, bound, and independently tested. Repository CI must never manufacture runtime-host or LIVE evidence.
