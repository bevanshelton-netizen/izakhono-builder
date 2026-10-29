# IZAKHONO NODE HEARTBEAT CONTRACT

## Purpose

The node heartbeat gives the IZAKHONO control plane a machine-readable health and capacity signal from every owned node. It deliberately reports operational facts only and never exposes credentials or secrets.

## Contract

`izakhono.node-heartbeat/v1`

Required fields:

- `node.id`
- `node.hostname`
- `timestamp`
- `health`
- `capacity`
- `runtime`
- `checks`

Health values:

- `healthy` — required baseline checks pass.
- `degraded` — one or more baseline checks fail.

Baseline checks:

- `nodeReachable`
- `persistentStorageReady`
- `containerRuntimeReady`
- `monitoringOnline`

## Security

The heartbeat payload contains no passwords, API keys, tokens, private keys, or customer content. Authentication of transport is handled by the node/control-plane adapter and its configured secret or mTLS layer; credentials are never stored in this contract or in Git.

## Node operation

A node may emit the heartbeat periodically through the IZAKHONO node agent. The control plane may also invoke `check` through the node adapter before promotion.

## Promotion rule

A node must not be promoted to the production infrastructure-of-record role solely because a heartbeat exists. Promotion requires authenticated reachability plus the full readiness evidence defined by `owned-node-promotion` in `autonomy/engine-manifest.json`.

## Software-first rule

The heartbeat abstracts machine details behind a stable contract. The control plane consumes health/capacity data rather than depending on a particular hardware vendor, operating-system image, or cloud provider.
