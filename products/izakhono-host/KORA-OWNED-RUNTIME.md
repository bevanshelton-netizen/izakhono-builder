# KORA on IZAKHONO HOST

**Target:** `streamkoraafrica.com` is served by the native KORA Next.js container behind the IZAKHONO-owned Caddy edge. Vercel is not the target runtime.

This integration is deliberately opt-in. Adding these files does not start a container, provision a domain, issue a certificate, change DNS, or declare KORA live.

## What this adds

- A dedicated `kora-app` service in `docker-compose.kora.yml`, isolated on the existing private `izakhono` network.
- Caddy host routing for `streamkoraafrica.com` to `kora-app:3000`.
- A source checkout pinned to an exact KORA commit, not a floating branch.
- Build-time injection for public `NEXT_PUBLIC_*` configuration. Next.js compiles these values into the client bundle; runtime-only environment injection is insufficient.
- Runtime-only server credentials supplied from the local, ignored `kora.env` file.
- A liveness health check. KORA's strict `/api/readiness` remains a separate launch gate.

The KORA source revision used by this integration is:

`bevanshelton-netizen/Downloads@7e51386031821fbb9953981ce2dc07fbf6d9a110`

That revision adds configurable public build arguments to `kora-network/Dockerfile`. No production credentials are included in the image build.

## Required local files

1. `.env` — the normal HOST environment file, containing the public KORA build settings:
   - `KORA_PUBLIC_APP_URL=https://streamkoraafrica.com`
   - `KORA_SUPABASE_URL`
   - `KORA_SUPABASE_PUBLISHABLE_KEY`
   - `KORA_DB_SCHEMA=kora`
   - `KORA_VIDEO_PROVIDER=cloudflare`
2. `kora.env` — copy from `kora.env.example`, then populate server-only values from the approved FORTRESS secret source. Do not commit it or pass secrets as Docker build arguments.
3. `kora-source/` — a local checkout of the KORA source repository at the exact commit above.

The publishable Supabase key and public URL are intentionally build-time values. Supabase secret keys, Cloudflare Stream tokens, PayFast credentials and the KORA internal API secret are runtime-only values.

## Prepare the pinned source

From this directory, use the normal authenticated Git credential mechanism approved for the source repository. Do not put a GitHub token in the clone URL or shell history.

```bash
git clone https://github.com/bevanshelton-netizen/Downloads.git kora-source
git -C kora-source checkout --detach 7e51386031821fbb9953981ce2dc07fbf6d9a110
git -C kora-source rev-parse HEAD
```

The final command must print the exact commit above. The local checkout is ignored by Git and is never copied into this repository.

## Validate and build without starting services

The following commands validate the merged Compose model and build the application image. They do not start containers or change DNS:

```bash
docker compose --env-file .env -f docker-compose.owned.yml -f docker-compose.kora.yml --profile kora config
docker compose --env-file .env -f docker-compose.owned.yml -f docker-compose.kora.yml --profile kora build kora-app
```

Confirm the image digest after build and record it with the source commit in the DEPLOY release evidence. The local tag is a convenience label, not a substitute for the immutable image digest.

## Activation sequence — owner-authorized HOST session only

Do not perform this sequence until the HOST operator has verified the node binding, execution authorization, FORTRESS secret delivery, backup/rollback readiness and public network reachability.

1. Confirm the existing HOST stack is healthy.
2. Populate `kora.env` from FORTRESS-managed secret references; keep PayFast in sandbox and all legal, child-safety, payout, backup and incident approvals false until signed off.
3. Provision `streamkoraafrica.com` in the HOST control plane using its authenticated site-provisioning API. Caddy's on-demand TLS admission asks HOST whether the domain is provisioned; without this record, certificate issuance is denied.
4. Validate the merged Compose configuration and build the pinned KORA image.
5. Start the KORA profile and reload the edge in the same approved change window:

```bash
docker compose --env-file .env -f docker-compose.owned.yml -f docker-compose.kora.yml --profile kora up -d kora-app edge
```

6. Verify the KORA container health, then run the repository's `npm run smoke:owned-runtime` from the pinned KORA checkout with `KORA_OWNED_RUNTIME_TARGET` set to the owned HTTPS edge.
7. Require `/api/readiness` to pass for the intended release state. A healthy process is not launch acceptance.
8. Prove TLS, public DNS, intended content, playback, authentication, payment, backup/restore and rollback. Only then may a separately approved DNS cutover be considered.

## Rollback

The KORA service is isolated from the HOST control-plane and other customer sites. The approved operator can stop the KORA profile and restore the prior Caddy configuration/release. Keep the previous Vercel deployment available as a temporary fallback until the owned-runtime acceptance and rollback drill pass. Do not change DNS as part of this code change.

## Explicit non-claims

This integration does not implement FORTRESS secret injection, authenticated DEPLOY-to-HOST job dispatch, Runtime Fabric node registration, image-registry distribution, database migration ownership, or production DNS automation. It does not authorize an operator or prove a live node. Those remain separate gates and must not be inferred from a successful image build or local smoke test.
