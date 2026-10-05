# IZAKHONO NODE Fabric v2

## Purpose

NODE01 is a **logical primary role**, not a permanent physical machine. Any approved Linux host that passes the NODE bootstrap and health checks can assume node01, node02, node03 or another approved role.

The control plane keeps a pool of nodes and selects a healthy node for deployment work. If the preferred/primary node is unavailable, work can be routed to a healthy secondary node.

## Configuration

A single node remains backward compatible:

```text
IZAKHONO_NODE_URL=http://127.0.0.1:9191
IZAKHONO_NODE_SECRET=<secret>
IZAKHONO_NODE_ID=node01
```

For a pool, use `IZAKHONO_NODE_FABRIC` as JSON. Example:

```json
[
  {"id":"node01","url":"http://10.0.0.11:9191","secret_env":"IZAKHONO_NODE_NODE01_SECRET","role":"primary","weight":100},
  {"id":"node02","url":"http://10.0.0.12:9191","secret_env":"IZAKHONO_NODE_NODE02_SECRET","role":"worker","weight":100},
  {"id":"node03","url":"http://10.0.0.13:9191","secret_env":"IZAKHONO_NODE_NODE03_SECRET","role":"worker","weight":80}
]
```

Do not commit node secrets. Put them in the control host environment or a protected secret manager.

## Control endpoints

- `GET /healthz` — public process health.
- `GET /v1/fabric` — owner-authenticated node pool health and capabilities.
- `GET /v1/node` — owner-authenticated view of the selected healthy node.
- `GET /v1/status` — owner-authenticated status from the selected node.
- `POST /v1/deploy` — owner-authenticated deployment routed through the fabric.

A deployment request may include `node_id` as a preference. An unhealthy preferred node is not used; the scheduler fails over to another healthy node. If no node is healthy, control returns `503 no_healthy_node` rather than pretending deployment occurred.

## Security

Node health probes and jobs use the existing timestamp + nonce + HMAC-SHA256 protocol. Production deployments still require an immutable 40-character commit SHA. The fabric never returns node secrets.

## Bootstrap

`products/izakhono-node/bootstrap-node.sh` turns an approved Linux host into a logical IZAKHONO NODE role and writes an activation proof only after the local `/healthz` endpoint responds.

Physical activation remains a separate fact from software readiness: the repository can provide the replacement software and bootstrap procedure, but a real host must execute the bootstrap before it can be described as active.
