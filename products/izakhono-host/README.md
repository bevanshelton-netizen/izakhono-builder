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

## Independent website and mail activation

The website-hosting core must not be blocked by an email node that has not yet been activated.

- The default compose profile starts the website runtime, contact gateway, edge, DNS, PostgreSQL, MinIO and Valkey.
- The SMTP mail bridge is an optional `mail` profile.
- Activate it only after the separate IZAKHONO MAIL/Stalwart server is reachable and SMTP credentials, TLS and domain authentication have been configured.

After the base runtime is healthy, the mail bridge can be enabled with:

```bash
docker compose --profile mail --env-file .env -f docker-compose.owned.yml up -d mail-bridge
```

A running bridge is not proof of email service readiness. Verify inbound and outbound delivery, SPF, DKIM, DMARC, PTR/rDNS, TLS, spam controls and backup/restore before selling mailboxes. If mail transport is not configured, website hosting remains independently deployable; contact-form email delivery remains unavailable and must not be advertised as active.

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

For a first-time host this creates `.env` with generated secrets. Set `TLS_EMAIL` to the operational certificate address before public HTTPS activation. The base stack requires valid runtime/database/storage secrets. Never commit `.env`.

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
