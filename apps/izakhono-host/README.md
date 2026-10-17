# IZAKHONO HOST

Independent IZAKHONO hosting engine and control-plane foundation.

## Product boundary
IZAKHONO HOST owns hosting orchestration, tenant lifecycle, website/email hosting, TLS, databases, backups, monitoring and reseller workflows. `apps/izakhono-domains` remains the domain/registrar layer and is integrated through a replaceable adapter.

## Architecture rules
- IZAKHONO-owned infrastructure is primary.
- External compute, DNS, mail edge and registrars are replaceable resilience/adaptor routes.
- Each tenant must be isolated and quota constrained.
- No production secrets in source.
- No tracking, advertising identifiers or behavioural profiling.
- `public_live` stays false until NODE 01 deployment, HTTPS, tenant isolation, backup/restore and mail delivery gates pass.

## First acceptance tenant
`izakhonoafrica.co.za`, with `bevans@izakhonoafrica.co.za` as the first mailbox after the domain is under controlled delegation.

## Local
```sh
docker build -t izakhono-host .
docker run --rm -p 8788:8788 izakhono-host
curl http://localhost:8788/health
```
