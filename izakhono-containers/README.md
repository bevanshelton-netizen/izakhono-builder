# IZAKHONO Containers

IZAKHONO Containers is the sovereign container platform for the IZAKHONO developer ecosystem: registry, automated builds, image security, deployments and IZAKHONO Node management in one control plane.

## What this first slice proves

- A real web command centre, not a static design file.
- Runnable Node.js control service with health/dashboard/build/deployment APIs.
- Dockerfile + OCI compatibility.
- Self-hosted Docker Distribution registry for the first private registry node.
- A clean hand-off point for IZAKHONO CODE and the IZAKHONO Node fabric.
- No application framework dependency is required for the control-plane prototype.

## Run locally

```bash
cd izakhono-containers
node server.js
# open http://localhost:8080
```

Or with Docker:

```bash
docker compose up --build
```

Control panel: http://localhost:8080  
Registry endpoint: localhost:5000

## Product direction

The product is deliberately broader than Docker Hub:

1. **Registry** — private/public OCI repositories, immutable tags, replication and retention.
2. **Build Cloud** — Dockerfile/BuildKit-compatible remote builds with cache.
3. **Supply-chain security** — SBOM, signing, provenance and vulnerability gates before push/deploy.
4. **Node Fabric** — deploy directly to IZAKHONO-owned Linux nodes; no separate host required.
5. **Unified secrets** — scoped secrets for builds, deploys and services.
6. **Team & tenant controls** — organisations, projects, RBAC, audit logs and quotas.
7. **Africa edge** — registry mirrors/caches on regional IZAKHONO Nodes.
8. **Cost control** — local bandwidth/cache awareness and owner-defined quotas.
9. **Migration mode** — import images from Docker Hub/GHCR and continue using normal Docker/OCI clients.
10. **IZ CLI** — one command surface for login, build, push, scan, deploy, logs and rollback.

## Architecture target

```text
Developer / IZAKHONO CODE
          |
          v
 IZAKHONO Control API
   |       |       |
 Build   Registry  Security
   |       |       |
   +-------+-------+
           |
      Node Scheduler
           |
  +--------+--------+
 ISN-01  Edge Nodes  Future DC
```

## Required production hardening

The current API state is intentionally in-memory. Before public launch, replace it with durable PostgreSQL metadata, object storage/S3-compatible blobs, an authenticated OCI registry, signed workload identity, encrypted secret storage, audit logs, TLS termination, backups and multi-node scheduling.

Recommended standards: OCI Distribution Spec, OCI Image Spec, Sigstore/Cosign-compatible signing, SPDX/CycloneDX SBOMs and BuildKit-compatible builds.
