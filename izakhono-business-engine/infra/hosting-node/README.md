# IZAKHONO Hosting Node

This directory defines the first owned-first hosting node contract for the IZAKHONO Business Engine.

## Contract

The node is intentionally **not marked live by repository code alone**. A real machine, DNS endpoint, TLS certificate, deployment credential, and heartbeat must exist before `hosting-owned-node` can be promoted from `planned` to `ready` in Supabase.

The node exposes two internal capabilities:

- `GET /health` — liveness/readiness information
- `POST /v1/releases` — authenticated release submission

A release submission is expected to receive a build artifact URL plus checksum and return a provider request ID. The release executor must verify the node heartbeat before publishing.

## Security

- Never commit node tokens, SSH keys, certificates, or provider secrets.
- Put secrets in the runtime secret store/environment.
- Keep the deployment API private behind a firewall or private network where possible.
- The node must reject unsigned/unauthenticated release requests.
- Publication is not considered verified until the node returns a canonical HTTPS URL and the verification step can reach it.

## Bring-up

1. Provision a Linux host under IZAKHONO control.
2. Install Docker Engine and Compose.
3. Configure the runtime environment from `.env.example`.
4. Start the node with `docker compose up -d --build`.
5. Verify `/health` from a trusted network.
6. Register the verified endpoint/heartbeat in `izakhono_deployment_targets`.
7. Only then allow the release queue to claim the target.

Until those steps occur, the release system must remain blocked rather than pretending that an owned endpoint exists.
