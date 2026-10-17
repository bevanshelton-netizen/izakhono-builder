# IZAKHONO HOST

**The sovereign application hosting platform for the IZAKHONO ecosystem.**

IZAKHONO HOST is the owned-first alternative to the dependency model that makes application delivery hostage to a single hosting vendor. It is designed to provide the core experience developers expect from a modern application platform while keeping infrastructure replaceable and customer workloads portable.

## What it now provides

- Multi-tenant control plane
- Projects and application lifecycle
- Git/source deployment intake
- Deployment state and receipts
- Preview-environment URL boundary
- Custom-domain attachment and verification tokens
- Environment-variable management with secret flags
- Quotas and tenant isolation boundaries
- Durable local state with atomic writes
- Health, capability and metrics endpoints
- Provider-neutral adapters for build execution, DNS, registrar, mail and external compute
- Fail-closed authenticated production control API

## Vercel-class product direction

**Import → Build → Preview → Verify → Promote → Roll back → Monitor**

The next runtime layers will add:

1. Native build workers with isolated sandboxes.
2. Immutable deployment artifacts and content-addressed storage.
3. Atomic production promotion and instant rollback.
4. Edge/static serving and regional origin routing.
5. Automatic TLS and domain cutover through IZAKHONO DOMAINS.
6. Logs, metrics and deployment timelines.
7. Git webhook ingestion and automatic deployments.
8. Usage metering, plans and reseller controls.
9. Backup/restore and disaster-recovery replication.
10. Multi-NODE scheduling so one machine or provider cannot hold the platform hostage.

## Security rules

- IZAKHONO-owned infrastructure is primary.
- External compute, DNS, mail edge and registrars are replaceable resilience/adaptor routes.
- Production control routes require bearer authentication when `IZAKHONO_HOST_ADMIN_TOKEN` is configured.
- Tenant/project quotas are enforced before creation.
- Secrets are never returned by the environment-variable API.
- State writes use atomic replacement.
- No production-live claim is made by the control plane itself.
- `public_live` remains false until real NODE deployment, HTTPS, isolation, backup/restore and mail evidence exists.

## Local

```sh
docker build -t izakhono-host .
docker run --rm -p 8788:8788 \
  -e IZAKHONO_HOST_ADMIN_TOKEN=change-me \
  -e NODE_ENV=production \
  izakhono-host
curl http://localhost:8788/health
```

## Control-plane examples

Create a tenant:

`POST /api/v1/tenants`

Create a project:

`POST /api/v1/projects`

Attach a domain:

`POST /api/v1/projects/:id/domains`

Set an environment variable:

`PUT /api/v1/projects/:id/env`

Queue a deployment:

`POST /api/v1/deployments`

Inspect a deployment:

`GET /api/v1/deployments/:id`

## Truth boundary

This repository contains the hosting **engine/control-plane implementation**. A successful CI build is not the same thing as a public production hosting network. Physical NODE capacity, public DNS/TLS, artifact storage, build isolation, mail, backup/restore and independent failure-domain evidence must still be supplied by the owned runtime before IZAKHONO HOST is represented as fully live.
