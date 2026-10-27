# CONNECTA Vercel → IZAKHONO Runtime Migration

## Purpose

Move CONNECTA from Vercel-hosted deployments to the IZAKHONO Runtime Fabric without treating Vercel as the production dependency.

## Source of truth

- Repository: `bevanshelton-netizen/izakhono-builder`
- Branch: `main`
- Application: `products/izakhono-social`
- Engine: `products/izakhono-node`
- Runtime entrypoint: `node src/discovery-bootstrap.js`
- Owned compose: `docker-compose.owned.yml`

## Migration rule

Do not copy a Vercel deployment as the production artifact. Reproduce the deployment from the immutable Git commit on the owner-controlled runtime. This preserves source provenance, reproducibility and rollback.

## Required activation sequence

1. Select the exact approved `main` commit SHA.
2. Run `products/izakhono-node/production-host-preflight.sh` on the owner-controlled host.
3. Set the required runtime secrets outside Git, including the CONNECTA database password and owner key.
4. Run `deploy-runtime-fabric.sh` with the immutable SHA and runtime target.
5. Start the PostgreSQL + CONNECTA engine + CONNECTA web owned compose stack.
6. Verify local engine health and secure web→engine communication.
7. Run backup/restore and failover evidence checks.
8. Configure reviewed EDGE/TLS ingress.
9. Verify external HTTPS against the owner-controlled endpoint.
10. Run `production-deployment-gate.sh` and require all seven evidence artifacts to PASS.
11. Only then mark CONNECTA `PUBLIC_VERIFIED`.

## Vercel role during migration

Existing Vercel deployments remain rollback/fallback references. They are not copied into production, and no Vercel deployment is declared an IZAKHONO-owned deployment merely because its source repository matches.

## Hard boundary

This runbook is executable only when an actual owner-controlled runtime target is available. The repository does not claim that the planned NODE01 physical machine exists. DNS, TLS and public traffic must not be changed until the production evidence gates pass.
