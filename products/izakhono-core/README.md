# IZAKHONO Core v0.1

Self-hosted application backend for the IZAKHONO platform family.

## Purpose

IZAKHONO Core is the owner-controlled backend counterpart to the IZAKHONO Launch Stack. It is designed to remove the basic application dependency on hosted backend platforms while keeping migration fail-closed for products with sensitive data or regulated workflows.

Core v0.1 provides:

- PostgreSQL-backed project isolation
- browser-public project keys
- password authentication
- short-lived HMAC access tokens
- rotating one-time refresh tokens
- login throttling
- authenticated generic CRUD
- safe owner-default row isolation
- explicit project-shared table policy
- owner-private object storage on a persistent volume
- WebSocket realtime events that respect the same owner/project visibility mode
- audit events
- health and capability endpoints

## Important boundary

This is a real working backend runtime, but it is **not yet a drop-in replacement for every Supabase feature**. It deliberately does not claim relational nested selects, application RPC parity, Edge Function parity, password-recovery email, or ECD360's complex centre/role RLS rules.

For ECD360 specifically, Core v0.1 is a sovereign canary target only. The existing managed backend remains the production/pilot adapter until protected workflow parity is proved. Do not move real child data, live payroll finalisation, or live payments to Core merely because the container is healthy.

## Environment

Required secrets:

```text
IZAKHONO_CORE_JWT_SECRET=<32+ random characters>
IZAKHONO_CORE_ADMIN_TOKEN=<32+ random characters>
```

PostgreSQL is read from standard `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` variables, or `DATABASE_URL`.

Useful runtime controls:

```text
PORT=8787
IZAKHONO_CORE_ALLOWED_ORIGINS=https://app.example.com
IZAKHONO_CORE_TRUST_PROXY=true
IZAKHONO_CORE_STORAGE_DIR=/data/storage
IZAKHONO_CORE_MAX_JSON_BYTES=1048576
IZAKHONO_CORE_MAX_STORAGE_BYTES=10485760
```

## Project provisioning

Projects are created only through the server-side admin endpoint. The admin token never belongs in a browser bundle.

```bash
curl -fsS https://core.example.com/v1/admin/projects \
  -H "Authorization: Bearer $IZAKHONO_CORE_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "project":"my-app",
    "allow_signup":true,
    "table_policies":{"shared_announcements":"project"}
  }'
```

The response contains a generated `public_key`. That key identifies the project and may be used by the browser as `X-Project-Key`; it is not an administrator secret.

A project key cannot be silently rotated. Rotation requires the explicit `rotate: true` field.

## Data policy

Every table defaults to `owner`: a user sees and mutates only rows created by that user. A table may be provisioned as `project` when every authenticated user in that project is intentionally allowed to share those records.

Those two modes are intentionally insufficient for ECD360's centre/role security model. Complex policies must be implemented and proven before ECD360 protected workflows can migrate.

## API shape

The browser bridge currently targets:

- `POST /v1/auth/:project/signup`
- `POST /v1/auth/:project/signin`
- `POST /v1/auth/:project/refresh`
- `POST /v1/auth/:project/signout`
- `GET /v1/auth/:project/me`
- `GET|POST /v1/data/:project/:table`
- `PATCH|DELETE /v1/data/:project/:table/:id`
- `PUT|GET|DELETE /v1/storage/:project/:bucket/*path`
- `WS /v1/realtime/:project`
- `GET /healthz`
- `GET /v1/capabilities`

## Build and test

```bash
npm install --ignore-scripts --no-audit --no-fund
npm run check
npm run test:e2e

docker build -t izakhono/core:0.1.0 .
```

The E2E test requires a disposable PostgreSQL database and proves project-key rejection, password auth, refresh-token rotation, owner row isolation, project-shared rows, owner-private storage and realtime visibility boundaries.

## Independence principle

IZAKHONO Core uses standard PostgreSQL, Node.js, local persistent storage and ordinary WebSockets. These components can run on an owner-controlled Linux host through IZAKHONO Launch Stack. DNS, the physical/virtual host, certificate authority connectivity, banking rails and reputation-safe transactional email remain external dependencies until IZAKHONO operates those layers itself.
