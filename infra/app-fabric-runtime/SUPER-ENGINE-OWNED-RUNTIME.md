# IZAKHONO Super Engine — Owned Runtime

The Super Engine is packaged as a Linux container and is deployed only through the owned production runtime.

## Runtime contract

- Image: `izakhono/super-engine:<git-sha>`
- Service: `super_engine`
- Private network: `izakhono_private`
- Health endpoint: `GET /health`
- Read-only module inventory: `GET /modules`
- Container user: `node`
- Linux capabilities: dropped
- `no-new-privileges`: enabled

## Production gate

The GitHub Actions workflow requires a self-hosted production runner with the environment marker:

`IZAKHONO_OWNED_RUNTIME=true`

This marker is intentionally required so an ordinary GitHub-hosted runner cannot be mistaken for the owned production infrastructure.

## Rollback policy

The deployment workflow is deliberately conservative: a failed health check stops promotion. The existing container remains the recovery target until an explicit rollback controller is attached to the owned runtime. No public-live claim is made from a successful GitHub build alone.
