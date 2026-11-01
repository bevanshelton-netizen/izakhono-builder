# IZAKHONO Application Fabric Runtime

The Application Fabric is the common production contract for IZAKHONO applications. Products do not receive bespoke hosting pipelines. They provide an `izakhono.app/v1` manifest and enter the same validation, packaging, provisioning, health, acceptance, promotion and rollback flow.

## Validate manifests

From this directory:

```bash
./validate-manifests.sh
```

The validator fails closed unless every manifest has:

- `izakhono.app/v1` schema
- safe unique slug matching its filename
- canonical source path and branch
- valid container port and health endpoint
- `izakhono_private` runtime network
- non-root `node` runtime user
- IZAKHONO-owned, owned-first production policy
- a software/runtime node target (`NODE01`–`NODE04`)
- `live: false` before physical acceptance
- mandatory immutable-image rollback identity

The validator is repository-side evidence only. It does not claim that a physical node, public DNS, HTTPS, deployment or LIVE state exists.
