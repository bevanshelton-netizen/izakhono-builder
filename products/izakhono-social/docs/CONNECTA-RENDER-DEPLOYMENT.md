# CONNECTA on Render

These Blueprints deploy the **same CONNECTA ENGINE** that runs on IZAKHONO-owned infrastructure. Render supplies only replaceable infrastructure.

## Blueprint paths

Render supports custom Blueprint filenames and paths. Use one of:

- `products/izakhono-social/render.preview.yaml`
- `products/izakhono-social/render.production.yaml`

## One-container external architecture

`Dockerfile.external` packages:

- CONNECTA Next.js web;
- CONNECTA ENGINE;
- CONNECTA-owned migrations;
- CONNECTA moderation/safety/trust logic.

The web process talks only to the co-located CONNECTA ENGINE over loopback. The browser never receives the engine session token; the existing Next.js secure proxy keeps it in an HTTP-only cookie.

## R0 Preview

The preview Blueprint uses Render's Free web service and Free PostgreSQL.

It is **validation-only**, because Render documents that:

- Free PostgreSQL expires 30 days after creation.
- Free web services cannot attach persistent disks.
- Free PostgreSQL has no managed backups.

Therefore the preview route may be called **EXTERNAL PREVIEW VERIFIED** after testing, but must not be called durable production LIVE.

## Production-ready Blueprint

The production Blueprint uses the same application container plus:

- durable Render PostgreSQL;
- a persistent disk mounted at `/var/lib/connecta/media`;
- generated CONNECTA owner secret;
- `/health` as the full web + engine + database + storage gate.

This file is infrastructure-as-code only. Do **not** deploy paid resources without explicit spend approval.

## Verification gate

Before changing status to EXTERNAL LIVE VERIFIED:

1. public HTTPS `/health` returns 200;
2. health proves CONNECTA ENGINE, database and storage are healthy;
3. registration/login succeeds;
4. community creation persists;
5. posts persist across restart;
6. media persists across restart;
7. backup + restore proof passes;
8. rollback is tested;
9. no behavioural analytics, ad IDs or third-party profiling are enabled.
