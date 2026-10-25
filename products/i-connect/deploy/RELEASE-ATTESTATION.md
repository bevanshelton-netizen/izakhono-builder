# I-CONNECT Owned Release Attestation

## Purpose

This document defines the release evidence required before an I-CONNECT build may be admitted to an IZAKHONO-owned production node.

## Release identity

- Repository: `bevanshelton-netizen/izakhono-builder`
- Deployment mode: IZAKHONO-owned Docker/Compose runtime
- Primary external runtime dependency: none
- Vercel: fallback only; not required for owned deployment
- PSTN activation: separately gated
- Real billing activation: separately gated

## Required evidence

1. Source commit is identified and reviewed.
2. `products/i-connect/deploy/preflight-owned.sh` passes on the target node.
3. `products/i-connect/deploy/admit-owned-node.sh` passes on the target node.
4. `products/i-connect/deploy/deploy-owned.sh` invokes the admission gate before build/start.
5. `products/i-connect/deploy/docker-compose.owned.yml` resolves without production secrets committed to Git.
6. Deployment environment file exists only on the target node and is permissioned `0600`.
7. Backup and restore scripts are present and syntactically valid.
8. Recovery rehearsal remains non-destructive.
9. Application health endpoint responds after deployment.
10. PSTN and real billing remain disabled until their independent readiness gates are satisfied.

## Current source checkpoint

The deployment admission enforcement is present in commit `7cffead40e30de35362e5d3501824bf3e4369b04`, which inserts `admit-owned-node.sh` between preflight and deployment. Do not treat this commit alone as proof of successful deployment or CI execution.

## Node attestation record

Complete this section only from an actual target node; never infer values.

- Target hostname: `TBD`
- Target owner/control: `TBD`
- Node OS: `TBD`
- Docker version: `TBD`
- Docker Compose version: `TBD`
- Git commit deployed: `TBD`
- Compose definition hash: `TBD`
- Application health result: `TBD`
- External hostname/DNS verified: `TBD`
- TLS verified: `TBD`
- Backup verified: `TBD`
- Recovery rehearsal verified: `TBD`
- PSTN gate: `TBD`
- Billing gate: `TBD`
- Attested by: `TBD`
- Attestation timestamp: `TBD`

## Safety rule

A repository commit, successful build, or CI result does not constitute production deployment. Production status requires evidence from the actual IZAKHONO-controlled node and successful health verification.
