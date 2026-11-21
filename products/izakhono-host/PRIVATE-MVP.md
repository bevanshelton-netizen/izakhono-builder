# IZAKHONO HOST — Private MVP

**Canonical project:** IZAKHONO HOST  
**Project ID:** IZK-HOST-001  
**Portfolio:** IZAKHONO AFRICA / Shared Digital Infrastructure

This fast-track profile activates the minimum useful owned-host stack on one existing Linux machine with Docker Engine and Compose v2:

- Native IZAKHONO site control-plane runtime
- PostgreSQL-backed compute manager
- One non-root compute worker with one-time enrollment and a persisted per-worker credential
- Private Docker bridge network
- Local-only runtime health endpoint on `127.0.0.1:18080`

It deliberately excludes public ingress, customer DNS/TLS, mail, object storage, external registration and arbitrary build execution. Those capabilities remain gated until their own security and recovery checks pass.

## Requirements

- Linux host with Docker Engine and Compose v2
- Python 3 and curl
- At least 2 CPU cores, 4 GB RAM and 20 GB free disk recommended
- An operator-controlled machine; no cloud account or purchase is created by this script

## Activate

From this directory:

```bash
bash ./MVP-ACTIVATE.sh
```

The script creates a private `.env.mvp` file with random secrets (mode 0600), validates the Compose model, builds the three owned services, starts PostgreSQL and the compute manager, issues a single-use enrollment token, verifies the worker is online, starts the native site runtime and checks its health endpoint. It then removes the consumed enrollment token from the environment file.

The Compose profile exposes only `127.0.0.1:18080`; it does not publish manager or worker ports and does not expose a public customer endpoint.

## Verify

```bash
curl --fail http://127.0.0.1:18080/health
docker compose --env-file .env.mvp -f docker-compose.mvp.yml ps
docker compose --env-file .env.mvp -f docker-compose.mvp.yml logs --tail=100
```

## Stop / preserve data

```bash
docker compose --env-file .env.mvp -f docker-compose.mvp.yml down
```

Do not add `-v`: named volumes contain PostgreSQL, manager, worker credentials and site state. Backups and restore verification are required before treating this MVP as production-ready.

## Security and status boundaries

- No Docker socket is mounted into the worker.
- The worker runs as the non-root image user and has no published port.
- Manager and worker communicate only on a private Docker bridge.
- The runtime health port is loopback-only.
- `.env.mvp` contains production-grade secrets; keep it off Git and restrict host access.
- The compute worker remains limited to the existing fixed task allow-list. This profile does not run arbitrary builds or user-supplied code.
- A successful activation proves local health only. It does not prove public DNS, TLS, external availability, backup restoration, high availability or customer production acceptance.

For the full owned platform and evidence requirements, see `ACTIVATION-RUNBOOK.md` and `SOVEREIGN-COMPUTE-FABRIC-V1.md`.
