# IZAKHONO DATA — replicated node storage

This layer provides replicated persistent storage for the four-node IZAKHONO cluster.

The first implementation uses Longhorn 1.12.1, installed inside the owner-controlled k3s cluster. The goal is not provider lock-in; applications depend on the Kubernetes StorageClass contract so the storage engine can be replaced later without rewriting the applications.

## Layout

- NODE 01: storage replica host
- NODE 02: storage replica host
- NODE 03: storage replica host
- NODE 04: storage replica host + separate encrypted backup target

Default application volumes use three replicas. Losing one node therefore does not destroy the active persistent volume.

Backups remain separate from replicas. A replicated volume is not a backup.

## Requirements on each node

- Linux
- k3s node already joined and Ready
- dedicated data path: /srv/izakhono/longhorn
- open-iscsi / iscsi initiator support
- NFS client support for RWX volumes
- sufficient free disk space
- synchronized time

## Install

Run on NODE 01 only:

```bash
sudo ./install-storage.sh
sudo ./verify-storage.sh
```

The installer places the pinned HelmChart into the k3s server manifests directory and waits for Longhorn to become available.

## Safety

Do not call storage production-ready until:

1. all four nodes are visible to Longhorn;
2. a three-replica test volume is healthy;
3. one node is powered down and the volume remains healthy/attachable;
4. the node rejoins and replicas rebuild;
5. an encrypted off-cluster or DR-node backup succeeds;
6. a restore is rehearsed.

Longhorn replicas protect against a node/disk loss. Restic/Longhorn backup targets protect against deletion, corruption and cluster-wide loss.
