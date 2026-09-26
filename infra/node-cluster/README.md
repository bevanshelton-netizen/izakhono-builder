# IZAKHONO NODE CLUSTER v1

> **Runtime Fabric boundary (26 Sep 2026):** This four-node cluster is the long-term owner-controlled HA target. It is not a prerequisite for public product availability and it must not make NODE01 a portfolio-wide launch gate. Products should first inherit the node-agnostic standard in `../runtime-fabric/README.md`.

This directory turns IZAKHONO NODE from a single-machine runtime into a four-node owner-controlled cluster.

## Topology

| Node | Preferred role | Cluster role | Backup role |
| --- | --- | --- | --- |
| NODE 01 | bootstrap preference | k3s server/control-plane + worker | owned workload host |
| NODE 02 | peer controller | k3s server/control-plane + worker | owned workload host |
| NODE 03 | peer controller | k3s server/control-plane + worker | owned workload host |
| NODE 04 | DR/workload | k3s worker + backup repository | recovery store |

NODE01 may bootstrap this specific k3s cluster, but production applications must not depend on NODE01 being alive. Public launch/failover is governed by the Runtime Fabric, not by this cluster's bootstrap order.

The cluster uses three control-plane members (NODE01-03) so control-plane quorum survives one controller failure. NODE04 remains outside the etcd voting set so it can act as a simpler disaster-recovery and workload node.

## Design goals

- owner-controlled Linux runtime
- no single-node dependency
- encrypted Kubernetes secrets at rest
- encrypted pod network using WireGuard-native flannel
- automatic workload rescheduling after node failure
- scheduled etcd snapshots
- encrypted service/data backups
- explicit health proof before this cluster is called production-ready
- public traffic exposed only through IZAKHONO EDGE
- databases, admin panels and container ports remain private

## Cluster bootstrap order

This order is only for forming this k3s cluster:

1. Prepare all four Linux machines with static IPs, patched OS and SSH key access.
2. Copy and edit `cluster.env.example` outside source control.
3. On NODE01 run `sudo ./bootstrap-primary.sh`.
4. Read the join token on NODE01.
5. Join NODE02 and NODE03 as servers.
6. Join NODE04 as a worker.
7. Run `verify-cluster.sh` from an authorized admin host with cluster credentials.
8. Configure encrypted backups and run `backup.sh`.

Product releases do not wait for this procedure if another Runtime Fabric target is already healthy.

## Production proof for this cluster

- all four physical nodes visible and Ready
- NODE01-03 etcd/control-plane quorum healthy
- NODE04 schedulable
- encrypted backup and restore rehearsal succeed
- each controller is failed individually during controlled tests
- replicated/stateless service remains available
- public edge routing is externally tested
- UPS/power-loss recovery is tested
- secrets are not stored in GitHub or application images

## Important boundary

This repository builds cluster software and operating procedures. It cannot prove physical machines, LAN, UPS, public routing or disk durability until real hardware is installed and tested.
