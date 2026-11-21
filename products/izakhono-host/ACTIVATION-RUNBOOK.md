# IZAKHONO HOST — Customer #001 Activation Runbook

## Customer
- Domain: xqwaxqwamile.com
- Customer: !XQWAXQWAMILÉ HOLDINGS (PTY) LTD

## Production rule
IZAKHONO HOST is provisioned on the owned runtime first. No customer is marked live from a historical screenshot, a repository state, or a provider dashboard. A live state requires current external evidence.

## Server-side secrets
Configure these only on the owned runtime host:
- HOST_RUNTIME_TOKEN
- TLS_EMAIL
- POSTGRES_PASSWORD
- MINIO_ROOT_USER
- MINIO_ROOT_PASSWORD

Optional reversible adapters may use their own server-side credentials, but they are not the site runtime of record.

## Activation sequence
1. Confirm NODE01 has Docker Engine/Compose and persistent storage.
2. Set the runtime secrets from the secure host environment; never commit them.
3. Run `docker compose --env-file .env -f docker-compose.owned.yml config` and confirm the J.A.R.V.I.S. secrets are present without printing their values.
4. Start PostgreSQL first, wait for `pg_isready`, then apply the explicit J.A.R.V.I.S. migration with `docker compose --env-file .env -f docker-compose.owned.yml run --rm --no-deps -e JARVIS_ALLOW_SCHEMA_MIGRATION=1 jarvis-api npm run migrate`.
5. Run `./bootstrap-owned.sh`; it builds the owned services, starts the stack and waits for HOST and J.A.R.V.I.S. health checks.
6. Verify HOST `GET /health` and J.A.R.V.I.S. `GET /health/ready` from inside their containers. J.A.R.V.I.S. is private to the `izakhono` Docker network and is not published directly to the public interface.
7. Provision the customer site through `/api/sites/provision` using the customer domain and a stable site ID.
8. Confirm the generated site responds through the native runtime with the correct Host header.
9. Point the customer's public A/AAAA records to the owned edge address and verify from independent public resolvers.
10. Allow Caddy on-demand TLS to obtain a public certificate only after the domain is admitted by `/api/tls/ask`.
11. Verify HTTPS for apex and any explicitly provisioned `www` hostname.
12. Mark the site accepted only when HTTPS, DNS and content evidence are all true.
13. Configure the selected mail plane and publish MX, SPF, DKIM and DMARC records; mail activation remains separately evidence-gated.
14. Run backup, restore and rollback tests before final handover.

## Evidence requirements
- Runtime: health endpoint returns success.
- DNS: independent public resolution reaches the owned edge.
- Site: correct content is served for the customer's hostname.
- SSL: independent HTTPS request succeeds with a trusted certificate.
- Mail: MX plus authenticated send/receive test.
- Billing: payment evidence before changing invoice/subscription state.
- Recovery: backup and restore test succeeds.

## Customer #001 rule
Do not infer payment clearance, mail activation, SSL issuance, DNS delegation, or public live status from historical records. Current evidence is mandatory.
