# IZAKHONO ONE Software NODE gateway deployment

## Runtime model

Run the gateway as a long-lived Node.js process inside an authorized Software NODE execution environment. The gateway is not a Vercel serverless function and is not a physical-server requirement. The software runtime provides the process, network, persistence and lifecycle capabilities.

The gateway starts two local listeners:
- Public gateway: `PUBLIC_PORT` or platform `PORT` (default 8780), bound to `HOST` (default `0.0.0.0`).
- Internal IZAKHONO ONE service: `IZAKHONO_ONE_INTERNAL_PORT` (default 8781), bound by `server.mjs` to loopback.

These ports must differ. The gateway sets `process.env.PORT` to the internal port before importing `server.mjs`. This avoids the prior port collision.

## Start and checks

From `products/izakhono-one`:

```bash
npm run check
npm run test:node-gateway
npm run node-control
npm run start:gateway
```

The gateway will fail closed at startup unless the control token, node-token map, Supabase URL and Supabase service-role key are configured.

## Required server-side configuration

- `PORT` — public listener port supplied by the software runtime (optional; default 8780).
- `PUBLIC_PORT` — optional explicit public listener port; takes precedence over `PORT`.
- `IZAKHONO_ONE_INTERNAL_PORT` — internal ONE service port (default 8781); must differ from public port.
- `HOST` — public bind host (default 0.0.0.0).
- `INTERNAL_HOST` — internal service host (default 127.0.0.1).
- `IZAKHONO_CONTROL_TOKEN` — high-entropy control-plane bearer token.
- `IZAKHONO_NODE_TOKENS_JSON` — JSON object mapping each registered node ID to its unique heartbeat token.
- `SUPABASE_URL` — persistence endpoint.
- `SUPABASE_SERVICE_ROLE_KEY` — server-only persistence credential.
- `SUPABASE_SCHEMA` — schema name (defaults to `one`).

All secrets belong in the Software NODE's protected secret store. Never commit them, return them to clients, or paste them into chat.

## Gateway contract

- `GET /api/nodes` — control-token authenticated ready-node registry.
- `POST /api/nodes/{nodeId}/heartbeat` — node-specific token.
- `POST /api/nodes/{nodeId}/workload` — control-token and FORTRESS-governed authorization.
- `POST /api/nodes/{nodeId}/deploy` — record execution verification for the exact authorized revision.
- `POST /api/nodes/{nodeId}/drain` — control-token governed drain.

Authorization is not execution. A node agent must run the exact authorized revision and then report it through the deployment endpoint. Unknown, unhealthy, draining, offline or insecure nodes fail closed. No automatic external failover is implied.

## Readiness gate

Before connecting SHELTON FREIGHT GROUP, verify:
1. Gateway process starts with separate public and internal ports.
2. Public HTTPS edge reaches the gateway without redirects or path rewriting.
3. Missing/invalid control credentials return 401.
4. `GET /api/nodes` returns a valid registry response to the authorized control client.
5. Supabase schema `one` has the required `node_registry` and `node_events` tables and RLS/service-role access is validated.
6. At least one Software NODE is registered, healthy and FORTRESS-ready.
7. An isolated test workload is authorized, executed by its agent, and reported through `/deploy`.

A successful build or HTTP health check alone does not prove a node is ready or a workload deployed.
