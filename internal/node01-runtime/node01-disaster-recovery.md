# IZAKHONO NODE01 Disaster Recovery

## Objective
Restore the owned compute platform without depending on Vercel, Cloudflare, or another external hosting platform.

## Recovery order
1. Recover Linux host and Docker Engine.
2. Restore `/opt/izakhono/node01-runtime` configuration and policies.
3. Restore the private registry and verify registry health.
4. Verify NODE01 control health on port 8090.
5. Restore approved workload images from the registry or verified image digests.
6. Start workloads one at a time.
7. Require `/health` to pass before promotion.
8. Restore the owned edge configuration.
9. Verify internal routes.
10. Record recovery timestamp and backup manifest used.

## Failure rules
- Never promote an unhealthy workload.
- Never restore secrets from Git.
- Never expose the private registry publicly.
- Never treat a successful image build as production deployment.
- Keep the previous known-good workload available for rollback.

## NODE02
NODE02 is a warm standby, not an active production dependency. Automatic promotion remains disabled until the secondary host is provisioned, tested and explicitly authorized for production failover.

## Recovery evidence
A recovery is considered complete only when control-plane health, registry health, workload health and route verification are all green.
