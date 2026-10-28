# IZAKHONO Four-Node Cluster Certification

**Status:** Certification contract
**Cluster:** `izakhono-production`
**Nodes:** `node01`, `node02`, `node03`, `node04`

## Canonical roles

| Node | Role | Control plane | Purpose |
|---|---|---:|---|
| NODE01 | Primary | Yes | Preferred production runtime |
| NODE02 | Backup-1 | Yes | Primary failover |
| NODE03 | Backup-2 | Yes | Secondary failover / quorum |
| NODE04 | Backup-3-DR | No | Disaster recovery / backup target |

The node identifiers describe IZAKHONO runtime nodes. They are not synonymous with physical desktop or workstation machines.

## Certification gates

A cluster may not be marked `LIVE_VERIFIED` until current evidence proves:

1. all four required nodes report healthy and schedulable;
2. the control-plane quorum has at least two healthy members;
3. every participating node reports the same approved immutable release identity;
4. the release is actually deployed and healthy on the serving node;
5. a controlled NODE01 failure test demonstrates failover to the approved sequence;
6. NODE04 backup/restore evidence is current and successful;
7. IZAKHONO EDGE routes only to a verified healthy node;
8. DNS and TLS resolve to the verified public edge;
9. an external HTTPS application smoke test succeeds;
10. rollback/recovery evidence is available.

## Evidence rules

Evidence must identify the node that produced it, the immutable release identifier, timestamp, result, and evidence hash where applicable.

Repository topology, configuration files, CI success, or an expected node name are **not** runtime proof.

No evidence may be inferred from another node. No simulated result may be promoted to production evidence.

## Failover order

`NODE01 → NODE02 → NODE03 → NODE04`

NODE04 is the disaster-recovery target and is not part of the control-plane quorum.

## Fail-closed rule

If any mandatory gate is missing, stale, contradictory, or failed, the cluster remains `BLOCKED` and public routing is not authorized.

## Operational principle

**Our Nodes are the runtime fabric.** External providers may remain reversible resilience/fallback capacity, but they do not replace NODE01–NODE04 as the canonical IZAKHONO architecture.
