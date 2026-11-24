# NODE01 GitHub Actions Runner

NODE01 is the authoritative IZAKHONO-owned production runtime for IZAKHONO NAV.

## Purpose

A self-hosted GitHub Actions runner on NODE01 allows the repository to execute approved, owner-controlled deployment and read-only verification workflows directly on the production node. A GitHub-hosted runner or repository CI pass is not physical-host evidence.

## Required runner identity and labels

Register the runner to the IZAKHONO repository that owns the deployment. The runner must retain GitHub's standard labels and include all three IZAKHONO labels:

- `self-hosted` (GitHub-managed)
- `linux` and `x64` where applicable (GitHub-managed)
- `izakhono-owned-host`
- `node01-runtime`

The installation script defaults to `izakhono,izakhono-owned-host,node01-runtime` as custom labels. The `izakhono` label is retained for existing workflows. Do not remove either required activation label. The signed NODE01 activation approval must attest the exact runner ID, service name, online health and labels.

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
- Use a short-lived registration token obtained by an authorised repository administrator; never commit it or store it in the evidence file.
- Do not place provider API keys in the repository.
- Keep AI credentials and other secrets on NODE01/server-side infrastructure.
- Do not expose the runner listener publicly.
- Run the runner under the dedicated non-root `izakhono-runner` account where practical.
- Docker access is effectively privileged; grant it only on the designated owner-controlled host and review the runner's workflow permissions before enabling deployment jobs.
- Keep runner software pinned and checksum-verified by the installer.

## Installation

On the actual NODE01 host, after its owner has approved the registration:

```bash
sudo IZAKHONO_GITHUB_RUNNER_TOKEN='<short-lived-token>' \
  scripts/launch-stack/install-actions-runner.sh \
  https://github.com/bevanshelton-netizen/izakhono-builder
```

Prefer the interactive/secure launcher where available so the token is not placed in shell history or process arguments. Do not paste the token into ChatGPT, issues, pull requests or logs.

After installation, verify the service locally without printing secrets:

```bash
sudo /opt/izakhono/actions-runners/default/svc.sh status
sudo systemctl list-units 'actions.runner.*.service' --no-pager
```

Then verify in GitHub repository Settings → Actions → Runners that the exact runner is **Online** and carries `izakhono-owned-host` and `node01-runtime`. Record the runner ID, service name, labels and evidence timestamp in the owner-controlled activation approval. Do not infer registration from the local service alone.

## Production flow

Approved workflow → exact NODE01 self-hosted runner → owner-approved host script → Docker runtime → IZAKHONO edge → independent verification.

The repository's existing deployment and verification scripts remain the source of truth. Host activation remains separately gated by the detached owner signature, host/source binding, runner attestation, database/FORTRESS prerequisites (if DEPLOY is enabled), backup/restore evidence and explicit operator confirmation.

## Current boundary

This document and installer change do not register a runner or activate NODE01. No runner registration token, physical host access, or owner approval is supplied by repository CI. A workflow must not target the NODE01 labels until the owner has registered and verified that runner.
