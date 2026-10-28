# CONNECTA Runtime Fabric Activation

This runbook activates CONNECTA through the IZAKHONO software runtime model.

## Activation states

`SOFTWARE_PACKAGED` -> `RUNTIME_TARGET_REQUIRED` -> `RUNTIME_PREFLIGHT_PASS` -> `DEPLOYMENT_REHEARSAL_PASS` -> `PRODUCTION_GATES_PASS` -> `PUBLIC_VERIFIED`

## Operator inputs

Set the selected runtime identity and provider before deployment:

```bash
export IZAKHONO_RUNTIME_ID="<logical-runtime-id>"
export IZAKHONO_RUNTIME_PROVIDER="<owned-or-approved-provider>"
```

Do not use a physical server name as the runtime identity.

## Preconditions

- The release SHA is immutable.
- The runtime is approved for CONNECTA.
- The runtime can execute the packaged application.
- Persistence and backup storage are available.
- Security controls are enabled.
- EDGE/TLS/DNS are independently controlled.

## Deployment

Use `deploy.sh` with an immutable production SHA. The deployment engine must verify local health before promotion and retain rollback capability.

## Production gate

Run `production-deployment-gate.sh` only after runtime evidence has been generated. The gate is fail-closed and cannot infer readiness from repository state alone.

## Public verification

Public promotion requires independent HTTPS verification against the promoted immutable release. Until that evidence exists, public status remains `NOT_YET_VERIFIED`.

## Failover rehearsal

1. Record the active runtime ID and release SHA.
2. Promote the same SHA to an approved alternate runtime.
3. Verify health and persistence.
4. Verify EDGE/TLS routing to the alternate runtime.
5. Record failover evidence.
6. Restore service to the preferred runtime using the same SHA.
7. Record failback evidence.

No application rebuild is permitted during failover/failback.
