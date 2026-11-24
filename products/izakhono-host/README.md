# IZAKHONO HOST v0.3

IZAKHONO HOST is the owned-first customer hosting control plane for domains, websites, SSL, DNS, email and billing.

## Production architecture

`IZAKHONO CODE → BUILDER → PROVISIONER → IZAKHONO NODE CLUSTER → CoreDNS/Caddy/TLS → native site runtime → FORTRESS`

The customer web runtime is owned by IZAKHONO. External services are bounded adapters and are not the runtime of record.

## Native runtime

`runtime/control-plane` now:
- provisions a tenant site record;
- creates the site's persistent public document root;
- serves static site content by customer hostname;
- exposes `/health`;
- exposes `/api/tls/ask` for Caddy on-demand TLS admission;
- records acceptance evidence for HTTPS, DNS and content;
- persists site/deployment state on the owned data volume.

`docker-compose.owned.yml` supplies the owned-runtime baseline: native runtime, Caddy edge, CoreDNS, PostgreSQL, MinIO and Valkey.

## Multi-node operation

`CLUSTER-NODE-ROLES.md` defines the production roles and resilience model. `NODE-PREFLIGHT.sh` validates a physical node before activation.

The platform can distribute CONTROL, EDGE, DNS, RUNTIME, DATA, MAIL, BACKUP and FORTRESS roles across the available owned nodes.

## Activation

On each designated node, run the preflight first:

```bash
./NODE-PREFLIGHT.sh
```

On the primary control/edge/runtime node:

```bash
./NODE01-ACTIVATE.sh
```

For a first-time host this creates `.env` with generated secrets. Set `TLS_EMAIL` to the operational certificate address before public HTTPS activation. Never commit `.env`.

The optional DEPLOY API is a separate Compose profile and is not started by the normal bootstrap. The signed owner approval must explicitly include `activate-deploy-control-api` in `allowed_actions`; otherwise NODE01 skips it. When authorised, NODE01 starts the internal-only `deploy-control` service and waits for its database-role, append-only audit and FORTRESS introspection startup checks.

Before adding that action to an owner approval, the infrastructure owner must provision the authoritative Runtime Fabric PostgreSQL database, apply the reviewed `deploy-control/migrations/0001_runtime_fabric_deploy.sql` through the approved migration runner, provision a non-owner runtime role with deployment SELECT/INSERT/UPDATE and audit SELECT/INSERT-only privileges, deploy the FORTRESS DEPLOY capability endpoints, and install the separate introspection secret in both approved secret stores. The detached approval must also include the SHA-256 database fingerprint returned by the read-only preflight, the production database ID/owner/migration-runner declarations, and the exact HTTPS FORTRESS introspection endpoint. NODE01 passes the signed fingerprint and endpoint to the API container; the API independently recomputes the database fingerprint and refuses startup on any mismatch. The optional service has no published host port; it is reachable only on the internal `izakhono` network. The repository changes do not apply migrations, configure secrets, deploy FORTRESS or activate the profile.

## Recovery

- `backup-owned.sh` creates a verified SHA-256 runtime backup.
- `restore-owned.sh <backup.tar.gz>` performs a controlled state restore after explicit confirmation.
- `runtime/control-plane/smoke.mjs` is the native end-to-end smoke test used by CI.

## DNS and HTTPS

Caddy uses on-demand public TLS and asks the native runtime whether a hostname is provisioned before a certificate can be issued. Public DNS still requires the customer's A/AAAA records to reach the owned edge, and authoritative DNS delegation requires independent external resolver evidence.

CoreDNS is included as the owned authoritative-DNS baseline. Secondary DNS capacity should run on independent owned nodes before production delegation is considered complete.

## Security

No customer can execute arbitrary infrastructure commands from the browser. Provisioning is represented as typed jobs and provider adapters. Production secrets are server-side only.

## Status vocabulary

- `planned`
- `queued`
- `running`
- `verified`
- `failed`
- `paused`

A service is not marked live without current verification evidence.
