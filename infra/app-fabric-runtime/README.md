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
- a logical software/runtime target (`NODE01`–`NODE04`)
- `live: false` until all independent production acceptance gates pass
- mandatory immutable-image rollback identity

## NODE identity and execution infrastructure

**NODE01–NODE04 are IZAKHONO software identities.** They are not physical machines, computers, servers, hostnames, or hardware assignments.

The execution environment is separate infrastructure consumed by the software. It may be physical, virtual, containerized, or distributed, and can be replaced without changing the identity of the NODE software. A runtime binding identifies that separate execution environment; it does not define or rename the NODE software.

## Evidence boundary

Repository validation and CI prove source contracts only. They do not prove that the software runtime is executing, that an execution environment is bound, or that public DNS, HTTPS, deployment, acceptance, promotion, or LIVE status exists.

Production acceptance must use independently collected evidence from the running software and its separately managed execution environment. Keep the immutable artifact identity available for rollback.