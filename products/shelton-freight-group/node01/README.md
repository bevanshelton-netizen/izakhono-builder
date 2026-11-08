# SHELTON FREIGHT GROUP — IZAKHONO Software NODE adapter

This adapter uses the existing IZAKHONO ONE gateway, not a guessed NODE01 API.

Verified gateway contract in this repository:
- GET /api/nodes — control-token authenticated ready-node list.
- POST /api/nodes/{nodeId}/workload — FORTRESS-governed workload authorization.
- Existing gateway also exposes heartbeat, deploy and drain actions; this adapter does not impersonate a node agent or claim to execute deployments.

Server-only environment:
- IZAKHONO_NODE_CONTROL_URL=https://<verified-control-origin>
- IZAKHONO_CONTROL_TOKEN=<server-side-control-token>

SFG endpoints (implemented in the freight portal package):
- GET /api/admin/node01/status — staff-only registry read.
- POST /api/admin/node01/authorize — owner-admin-only workload authorization request.

Authorization is not deployment. A Software NODE agent must execute the exact authorized revision and report it through /deploy before deployment is verified. No production-live claim, auto-registration, auto-promotion, or failover is made here.

Security: HTTPS only, redirects disabled, server-side token, six-second timeout, node ID path encoding, commit-SHA validation, and owner_admin gate for authorization.
