# IZAKHONO NAV — NODE01 Monitoring Runbook

## Purpose

The watchdog records observed NAV health on NODE01 and detects state transitions. It is not a deployment tool and never declares production live. The release receipt and full production verifier remain the authoritative promotion evidence.

## One-shot check

From the repository root on NODE01:

```bash
NAV_URL=http://127.0.0.1:8080 NODE01_ID=NODE01 bash infra/node01/node01-health-check.sh
```

The check requires all three endpoints to pass:

- `/health` identifies `IZAKHONO NAV`.
- `/ready` reports `ready: true`.
- `/version` reports `runtime: owned`.

## Watchdog execution

```bash
sudo install -d -m 0750 /var/lib/izakhono-nav
sudo NAV_URL=http://127.0.0.1:8080 NODE01_STATE_DIR=/var/lib/izakhono-nav bash infra/node01/node01-watchdog.sh
```

The watchdog writes `/var/lib/izakhono-nav/watchdog-state.json` atomically. It records the observed state, previous state, UTC timestamp, endpoint detail, and `production_claim: false`. A failed health check records `degraded` and returns a non-zero exit code.

## Optional transition alerts

Set `NODE01_ALERT_WEBHOOK` in NODE01's protected service environment, never in Git. The watchdog sends a notification only when the state changes. The webhook endpoint must accept a JSON object containing a `text` field. Do not put secrets in command-line arguments, repository files, or monitoring receipts.

## Scheduling

Run the watchdog every 1–5 minutes using NODE01's existing scheduler. Use a single-flight scheduler or a lock to prevent overlapping runs. Alert on a transition to `degraded`; avoid repeated notifications while the state remains unchanged. Retain state files with owner-only or service-account permissions.

## Recovery procedure

1. Inspect the watchdog state file and service/container logs.
2. Check Docker container health and Caddy edge health independently.
3. Restore service using the approved NODE01 deployment/recovery procedure.
4. Re-run the one-shot health check and full production verifier.
5. Generate a new release receipt only after all required checks pass.

## Security and claim boundaries

- The watchdog does not restart containers, change routes, or perform vehicle actions.
- It does not treat a missing endpoint as healthy.
- It does not establish public TLS or external reachability; those require separate checks.
- A watchdog `healthy` state is a local health observation, not proof of complete production readiness.
- Never claim NAV is live, deployed, or operational solely from a watchdog record.
