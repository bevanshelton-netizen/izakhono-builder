# IZAKHONO Runtime Fabric Recovery Runner

The recovery runner reconciles interrupted deployments from the durable PostgreSQL state store. It does **not** invent acceptance evidence or promote workloads to `LIVE_VERIFIED`.

## Required runtime inputs

- `IZAKHONO_RUNTIME_DATABASE_URL` — protected PostgreSQL connection string.
- `IZAKHONO_RECOVERY_ADAPTER` — importable provider/runtime adapter exposing:
  - `node_health(node) -> bool`
  - `resume_action(record) -> bool`
  - `rollback_action(record) -> bool`
  - `failover_selector(record) -> str | None`

Optional:

- `IZAKHONO_RECOVERY_OWNER_ID` — unique worker identity; default `recovery-worker`.
- `IZAKHONO_RECOVERY_LEASE_TTL_SECONDS` — lease duration; default `300`, minimum `30`.
- `IZAKHONO_RECOVERY_INTERVAL_SECONDS` — polling interval; default `60`, minimum `10`.
- `IZAKHONO_RECOVERY_ONCE=1` — perform one reconciliation pass and exit.

## Safety rules

1. The PostgreSQL deployment store is initialized before reconciliation.
2. Every active deployment must be leased before reconciliation.
3. A competing worker cannot take an unexpired lease.
4. An expired lease may be reclaimed.
5. Missing adapter functions fail closed.
6. Runtime actions are supplied by an explicit adapter; this runner never pretends to deploy infrastructure.
7. `LIVE_VERIFIED` remains controlled by the acceptance/live-gate layer.
8. Production secrets must come from the protected runtime secret store; never commit them to Git.

## Example one-shot invocation

```bash
export IZAKHONO_RUNTIME_DATABASE_URL='***protected secret***'
export IZAKHONO_RECOVERY_ADAPTER='izakhono_runtime_adapter'
export IZAKHONO_RECOVERY_OWNER_ID='node-recovery-worker-01'
export IZAKHONO_RECOVERY_ONCE='1'
python3 recovery_runner.py
```

The runner exits non-zero when required configuration, dependencies, or the runtime adapter are unavailable.
