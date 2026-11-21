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
- records public-live evidence only after an actual DNS lookup matches the configured owned EDGE IPs and a real HTTPS request succeeds with valid TLS;
- persists site/deployment state on the owned data volume.

`docker-compose.owned.yml` supplies the owned-runtime baseline: native runtime, Caddy edge, private-network CoreDNS, PostgreSQL, MinIO and Valkey. DNS is not published on the host's public port 53 by default. Contact gateway and SMTP bridge are an optional `mail` Compose profile and are not required to start the web runtime.

## Multi-node operation

`CLUSTER-NODE-ROLES.md` defines the production roles and resilience model. `NODE-PREFLIGHT.sh` validates the approved execution host before activation. Logical NODE01 identity remains separate from the host.

The platform can distribute CONTROL, EDGE, DNS, RUNTIME, DATA, MAIL, BACKUP and FORTRESS roles across the available owned nodes.

## Activation

Before activation, inventory the existing approved execution host with `bash infra/owned-runtime/host-inventory.sh`. This is read-only and does not install or alter anything.

On each designated node, run the preflight first:

```bash
./NODE-PREFLIGHT.sh
```

On the primary control/edge/runtime node:

```bash
./NODE01-ACTIVATE.sh
```

For a first-time host this creates `.env` with generated high-entropy secrets and restricts it to owner-only file permissions. Set `TLS_EMAIL` to the operational certificate address before public HTTPS activation. Set `PUBLIC_EDGE_IPS` to the exact public IPv4/IPv6 addresses assigned to the owned EDGE before public verification. Never commit `.env`.

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

A service is not marked live without current verification evidence. The old manual acceptance endpoint is disabled. `POST /api/sites/{site_id}/verify-public` performs a real DNS lookup, requires an exact match to `PUBLIC_EDGE_IPS`, then fetches the public HTTPS URL with certificate verification and requires a successful HTML response. Missing EDGE addresses, DNS mismatch, TLS failure or non-success responses leave the site not-live.
