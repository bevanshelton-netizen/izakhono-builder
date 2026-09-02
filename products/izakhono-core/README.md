# IZAKHONO Core v0.2

Self-hosted application backend for the IZAKHONO platform family.

## Purpose

IZAKHONO Core is the owner-controlled backend counterpart to the IZAKHONO Launch Stack. It is designed to remove basic application dependency on hosted backend platforms while keeping migration fail-closed for products with sensitive data or regulated workflows.

Core v0.2 provides:

- PostgreSQL-backed project isolation
- browser-public project keys
- password authentication
- short-lived HMAC access tokens
- rotating one-time refresh tokens
- login throttling
- authenticated generic CRUD
- safe owner-default row isolation
- explicit project-shared table policy
- scoped role policy primitives for centre/tenant-style applications
- explicit per-row read/write grants for relationship-specific access
- owner-private object storage on a persistent volume
- WebSocket realtime events for the existing owner/project policy modes
- audit events
- health and capability endpoints

## Scoped Policy Engine v0.2

The `/v2` policy API adds a deliberately narrow security primitive intended for applications such as ECD360. A `scope` table policy declares a JSON field such as `centre_id`, read roles and write roles. Users receive memberships for a specific scope and role. A separate row grant can give one user access to one record without granting the whole centre.

This supports patterns such as:

- Owner and Principal can read/write a centre's child records.
- Teacher can read child records and read/write observations but not finance.
- Accountant can access centre finance records without child/classroom access.
- Parent can receive an explicit read-only grant to one linked child without centre-wide access.
- A second centre remains isolated even inside the same Core project.

Admin policy endpoints are server-side only and require `IZAKHONO_CORE_ADMIN_TOKEN`:

- `POST /v2/admin/policies`
- `POST /v2/admin/memberships`
- `POST /v2/admin/row-grants`

Scoped application data uses:

- `GET|POST /v2/data/:project/:table`
- `GET|PATCH|DELETE /v2/data/:project/:table/:id`
- `GET /v2/capabilities`

## Important boundary

Core v0.2 is a real working backend runtime, but it is **not yet a drop-in replacement for every Supabase feature**. It still does not claim relational nested selects, application RPC parity, Edge Function parity, password-recovery email, or scoped realtime parity.

For ECD360 specifically, the policy engine now proves the main centre-role and parent-row-grant isolation primitives in CI. The existing managed backend nevertheless remains the production/pilot adapter until the application bridge, RPCs, Edge Functions, recovery flows and remaining protected workflows are ported and proven end-to-end. Do not move real child data, live payroll finalisation, or live payments to Core merely because the container and policy tests are healthy.

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

Every table defaults to `owner`: a user sees and mutates only rows created by that user. A table may be `project` when every authenticated user in that project is intentionally allowed to share those records. A `scope` policy uses a declared scope field plus memberships and row grants to enforce narrower access.

Scoped realtime is intentionally not claimed yet. The `/v1` realtime channel continues to support only the already-proven `owner` and `project` visibility modes.

## API shape

The base browser bridge targets:

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

The policy engine adds the `/v2` endpoints described above.

## Build and test

```bash
npm install --ignore-scripts --no-audit --no-fund
npm run check
npm run test

docker build -t izakhono/core:0.2.0 .
```

The base E2E suite proves project-key rejection, password auth, refresh-token rotation, owner row isolation, project-shared rows, owner-private storage and realtime visibility boundaries. The policy E2E suite separately proves synthetic Owner/Principal/Teacher/Accountant/Parent-style centre isolation, parent row grants, cross-centre denial and narrower write roles.

## Independence principle

IZAKHONO Core uses standard PostgreSQL, Node.js, local persistent storage and ordinary WebSockets. These components can run on an owner-controlled Linux host through IZAKHONO Launch Stack. DNS, the physical/virtual host, certificate authority connectivity, banking rails and reputation-safe transactional email remain external dependencies until IZAKHONO operates those layers itself.
