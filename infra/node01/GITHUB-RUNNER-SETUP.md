# NODE01 GitHub Actions Runner

NODE01 is the authoritative IZAKHONO-owned production runtime for IZAKHONO NAV.

## Purpose

A self-hosted GitHub Actions runner on NODE01 allows the repository to execute the existing NAV deployment and verification scripts directly on the production node.

## Runner label

Use the runner label:

`node01`

The runner should also retain the standard `self-hosted` label.

## Required NODE01 capabilities

- Linux host
- Docker Engine
- Docker Compose v2
- Git
- curl
- outbound HTTPS access to GitHub
- inbound access for the NAV domain through the existing IZAKHONO edge

## Security requirements

- Register the runner only to the IZAKHONO repository/organisation that owns this deployment.
- Do not place provider API keys in the repository.
- Keep AI credentials and other secrets on NODE01/server-side infrastructure.
- Do not expose the runner listener publicly.
- Run the runner under a dedicated non-root account where practical.
- Keep Docker access restricted to the runner account.

## Production flow

GitHub main branch -> NODE01 runner -> NAV deployment script -> Docker runtime -> Caddy TLS edge -> NAV verification.

The repository's `infra/node01/deploy-nav-node01.sh` and `infra/node01/verify-node01-nav.sh` remain the source-of-truth deployment and verification scripts.
