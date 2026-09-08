# IZAKHONO NODE CLUSTER v1

This directory turns IZAKHONO NODE from a single-machine runtime into a four-node owner-controlled cluster.

## Topology

| Node | Preferred role | Cluster role | Backup role |
| --- | --- | --- | --- |
| NODE 01 | PRIMARY | k3s server/control-plane + worker | preferred edge/data/workload host |
| NODE 02 | BACKUP 1 | k3s server/control-plane + worker | first failover target |
| NODE 03 | BACKUP 2 | k3s server/control-plane + worker | second failover target |
| NODE 04 | BACKUP 3 / DR | k3s worker + backup repository | third failover target and recovery store |

NODE 01 is the preferred primary, but production services must not depend on NODE 01 being alive.

The cluster uses three control-plane members (NODE 01-03) so control-plane quorum survives one controller failure. NODE 04 is deliberately kept outside the etcd voting set so it can remain a simpler disaster-recovery and workload node.

## Design goals

- owner-controlled Linux runtime
- no single-node dependency
- encrypted Kubernetes secrets at rest
- encrypted pod network using WireGuard-native flannel
- automatic workload rescheduling after node failure
- scheduled etcd snapshots
- encrypted service/data backups
- explicit health proof before any node is called production-ready
- public traffic exposed only through IZAKHONO EDGE
- databases, admin panels and container ports remain private

## Failover order

Preferred workload order:

1. NODE 01
2. NODE 02
3. NODE 03
4. NODE 04

Kubernetes may reschedule workloads automatically when a node is unavailable. Stateful applications still require application-level replication and tested restore procedures; a cluster does not magically make a single-copy database highly available.

## Minimum production hardware per node

Recommended starting point:

- x86_64 CPU, 8 cores minimum
- 32 GB RAM minimum
- 2 TB NVMe primary storage
- second SSD/NVMe for local backup or mirrored storage
- gigabit Ethernet minimum; 2.5 GbE preferred
- UPS
- Ubuntu Server 24.04 LTS or another supported hardened Linux distribution

NODE 01 may start larger (16 cores / 64 GB RAM) if budget permits.

## Network

Use static private IP addresses for all four nodes. Do not expose the Kubernetes API, kubelet, etcd, Docker/containerd sockets, databases or admin panels directly to the public internet.

Only IZAKHONO EDGE should receive public traffic.

Recommended private names:

- node01.izakhono.internal
- node02.izakhono.internal
- node03.izakhono.internal
- node04.izakhono.internal

## Installation order

1. Prepare all four Linux machines with static IPs, patched OS and SSH key access.
2. Copy and edit `cluster.env.example` outside source control.
3. On NODE 01 run:
   `sudo ./bootstrap-primary.sh`
4. Read the join token on NODE 01:
   `sudo cat /var/lib/rancher/k3s/server/node-token`
5. On NODE 02 and NODE 03 run:
   `sudo ./join-replica.sh server`
6. On NODE 04 run:
   `sudo ./join-replica.sh worker`
7. From NODE 01 run:
   `sudo ./verify-cluster.sh`
8. Configure encrypted backups and run:
   `sudo ./backup.sh`
9. Only after real-node proof should applications be migrated.

## Application migration order

Recommended first wave:

1. ALLEGRO Radio
2. IZAKHONO SEND
3. KORA
4. FAISReady
5. IZAKHONO CORE shared services

Payment settlement, authentication and production databases remain separately gated until their own replication, backup, security and restore tests pass.

## Production proof

The cluster is not production-ready merely because CI passes.

Required real-world evidence:

- all four physical nodes visible and Ready
- NODE 01-03 etcd/control-plane quorum healthy
- NODE 04 schedulable
- encrypted backup completes and restore rehearsal succeeds
- NODE 01 is powered down during a controlled test and a replicated stateless service remains available
- NODE 01 returns and rejoins cleanly
- public edge routing is externally tested
- UPS/power-loss recovery is tested
- secrets are not stored in GitHub or application images

## Important boundary

This repository builds the cluster software and operating procedure. It cannot prove the physical machines, LAN, UPS, public routing or disk durability until the actual hardware is installed and tested.
