# IZAKHONO Owned Release Acceptance

The owned Super Engine is not considered LIVE merely because a container starts or CI succeeds.

The acceptance gate is:

1. Candidate receipt exists under `/opt/izakhono/state/releases/izakhono-super-engine/`.
2. Receipt schema, application, network, HTTPS route and immutable artifact identity validate.
3. `super_engine` Docker health is `healthy`.
4. Local `/health` returns `ok=true`.
5. Public HTTPS `/health` returns `ok=true`.
6. The previous live receipt is preserved as the rollback target.
7. Only after all gates pass is `candidate.json` promoted to `live.json`.

Run on the owned production node:

```bash
sudo infra/runtime/VERIFY-OWNED-SUPER-ENGINE-RELEASE.sh
```

The script fails closed. A failed HTTPS or health check cannot promote a candidate.

## Important boundary

This contract does not create the physical node, register the GitHub self-hosted runner, configure DNS, or provision TLS. Those are separate infrastructure operations and require independent evidence.
