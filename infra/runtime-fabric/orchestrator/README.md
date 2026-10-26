# Runtime Fabric Orchestrator

The orchestrator is the policy layer between IZAKHONO release authority and provider adapters.

## Policy

1. Prefer `owned` runtime nodes.
2. Use `external-resilience` nodes only when they are the highest eligible candidate.
3. Exclude `disabled` and `degraded` nodes.
4. Require immutable release identity before execution.
5. Provision `provisionable` nodes through their provider adapter.
6. Require health before deployment.
7. Try the next eligible node when provisioning, health or deployment fails.
8. Never change application/source/data authority because infrastructure changes.
9. Never infer public `LIVE` status from provisioning or deployment success.

The output is a `RuntimePlan` containing explicit gates and selected/fallback nodes. Public activation remains a separate EDGE/TLS/DNS certification concern.
