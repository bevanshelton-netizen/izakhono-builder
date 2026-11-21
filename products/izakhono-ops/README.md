# IZAKHONO OPS™ v1

Owner operations companion for NODE/CONTROL/EDGE.

## Purpose

OPS is deliberately small and dependency-light. It gives the owner one local control surface for:

- NODE health/readiness
- CONTROL health
- registered platform inventory
- deployment readiness
- evidence directory status
- public-edge verification status

It does **not** replace NODE or CONTROL and it never exposes Docker, shell execution, secrets, or management credentials.

## Run

```bash
python3 ops.py
```

Default bind: `127.0.0.1:9393`.

Environment:

- `IZAKHONO_NODE_URL` default `http://127.0.0.1:9191`
- `IZAKHONO_CONTROL_URL` default `http://127.0.0.1:9292`
- `IZAKHONO_EVIDENCE_DIR` default `/var/lib/izakhono-node/evidence`
- `IZAKHONO_OPS_PORT` default `9393`

The UI is intentionally read-only. Deployment remains the responsibility of signed CONTROL jobs.
