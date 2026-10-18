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
3. Run the owned compose stack and wait for host-runtime, edge, PostgreSQL and Valkey health checks.
4. Verify `GET /health` from the host and from the LAN management path.
5. Provision the customer site through `/api/sites/provision` using the customer domain and a stable site ID.
6. Confirm the generated site responds through the native runtime with the correct Host header.
7. Point the customer's public A/AAAA records to the owned edge address and verify from independent public resolvers.
8. Allow Caddy on-demand TLS to obtain a public certificate only after the domain is admitted by `/api/tls/ask`.
9. Verify HTTPS for apex and any explicitly provisioned `www` hostname.
10. Mark the site accepted only when HTTPS, DNS and content evidence are all true.
11. Configure the selected mail plane and publish MX, SPF, DKIM and DMARC records; mail activation remains separately evidence-gated.
12. Run backup, restore and rollback tests before final handover.

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
