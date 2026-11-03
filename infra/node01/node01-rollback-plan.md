# IZAKHONO NAV — NODE01 Rollback Plan

## Objective
Restore the last verified NAV release without bypassing the production authorization boundary.

## Rollback sequence
1. Identify the last verified `release_commit` from the NODE01 release receipt.
2. Confirm the target commit exists in GitHub `main`.
3. Checkout the exact target release on NODE01.
4. Require explicit `NODE01_ALLOW_DEPLOY=1` authorization.
5. Run `infra/node01/deploy-nav-node01.sh`.
6. Run `infra/node01/node01-health-check.sh`.
7. Run `infra/node01/verify-node01-nav.sh`.
8. Generate a new `node01-release-receipt.sh` evidence record.

## Safety rules
- Never rollback to an unverified or guessed commit.
- Never expose credentials in logs or receipts.
- Never mark the runtime live until NODE01 verification succeeds.
- Never bypass the deployment guard.
- Rollback restores software state; it does not claim recovery of external data unless separately verified.
- If health/readiness fails after rollback, keep the deployment unclaimed and escalate to NODE01 operations.

## Evidence
A successful rollback requires a new verified release receipt identifying the exact commit, NODE01 target, verification timestamp, health, readiness, and owned-runtime identity.

## Status
`rollback_runbook_ready`
