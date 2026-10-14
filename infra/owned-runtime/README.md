# IZAKHONO OWNED RUNTIME v1

Clean-slate production runtime intended to remove hosting-provider deployment quotas from the critical path.

## Components

- **Caddy**: public HTTPS edge and static/site reverse proxy.
- **Knot DNS**: authoritative DNS service on UDP/TCP 53.
- **Runtime volume**: `/srv/izakhono/sites` is the production content source for static sites.
- **Health gate**: `/healthz` is required before a release is accepted.
- **Provider independence**: Vercel/Netlify/Cloudflare are adapters/fallbacks, not the source of truth.

## Required production prerequisites

The runtime needs an internet-reachable Linux host with a stable public IPv4 address, and preferably IPv6. DNS authority additionally needs two independent public nodes on UDP and TCP port 53. This repository supplies the software and configuration; it does not pretend a public server exists until external probes verify it.

## Deployment contract

1. Build immutable site artifacts.
2. Copy artifacts to the owned runtime release directory.
3. Run health checks.
4. Switch the active release only after health checks pass.
5. Keep the previous release for rollback.
6. Record external HTTP and DNS evidence before declaring `live`.

Never mark a service live from a build-success signal alone.
