# CONNECTA Vercel → IZAKHONO Owned-Node Cluster Migration

## Purpose

Move CONNECTA from Vercel-hosted deployments to the IZAKHONO-owned node cluster without treating Vercel as the production dependency.

## Source of truth

- Repository: `bevanshelton-netizen/izakhono-builder`
- Branch: `main`
- Application: `products/izakhono-social`
- Engine: `products/izakhono-node`
- Runtime entrypoint: `node src/discovery-bootstrap.js`
- Owned compose: `docker-compose.owned.yml`
- Primary owned node: `NODE01`

## Migration rule

Do not copy a Vercel deployment as the production artifact. Reproduce the deployment from the immutable Git commit on the IZAKHONO-owned node cluster. NODE01 is the primary owned production node; additional owned nodes provide failover, resilience and disaster-recovery capacity. This preserves source provenance, reproducibility and rollback.

## Required activation sequence

1. Select the exact approved `main` commit SHA.
2. Run `products/izakhono-node/production-host-preflight.sh` against the selected operator-controlled owned-node target, with NODE01 as the primary target where applicable.
3. Set the required runtime secrets outside Git, including the CONNECTA database password and owner key.
4. Run `deploy-runtime-fabric.sh` with the immutable SHA and owned-node runtime target.
5. Start the PostgreSQL + CONNECTA engine + CONNECTA web owned compose stack.
6. Verify local engine health and secure web→engine communication.
7. Run backup/restore and failover evidence checks across the owned node cluster.
8. Configure reviewed EDGE/TLS ingress.
9. Verify external HTTPS against the owned endpoint.
10. Run `production-deployment-gate.sh` and require all seven evidence artifacts to PASS.
11. Only then mark CONNECTA `PUBLIC_VERIFIED`.

## Vercel role during migration

Existing Vercel deployments remain rollback/fallback references. They are not copied into production and do not redefine the IZAKHONO production architecture.

## Hard boundary

The IZAKHONO-owned node cluster is the canonical production target, with NODE01 as the primary owned production node. Individual node selection beyond NODE01 is an operational placement/failover decision, not a change to the product architecture. Public status remains `NOT_YET_VERIFIED` until actual runtime evidence and all production gates pass. DNS, TLS and public traffic must not be changed until the production evidence gates pass.
