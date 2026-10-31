# IZAKHONO Owned Node Activation

This contract prepares the first permanent IZAKHONO production node without pretending that infrastructure access already exists.

## Required host contract

- Linux host with Docker Engine and Compose support.
- Persistent `/opt/izakhono` filesystem.
- `izakhono-edge` Docker network.
- Checked-in `/opt/izakhono/bin/izakhono-release` adapter.
- GitHub Actions self-hosted runner labels: `izakhono-owned`, `linux`.
- Production runner environment marker: `IZAKHONO_OWNED_RUNTIME=true`.
- Public HTTPS ingress configured for the production route.
- Backup and restore evidence before accepting production traffic.

## Bootstrap

From the checked-out repository, run as root:

```bash
export IZAKHONO_GITHUB_REPOSITORY=bevanshelton-netizen/izakhono-builder
./infra/runtime/BOOTSTRAP-OWNED-NODE.sh
```

The bootstrap creates the persistent state directories, creates `izakhono-edge` when absent, installs the checked-in release adapter, and writes a readiness record. It does **not** store a GitHub runner token and it does **not** claim public HTTPS readiness.

## Readiness gate

Run:

```bash
export IZAKHONO_OWNED_RUNTIME=true
./infra/runtime/OWNED-NODE-READINESS.sh
```

The gate must pass before the host is considered eligible for the production runner.

## Runner registration

Runner registration is intentionally an operator-controlled step because the repository does not have authority to mint or store a runner registration token. Register the runner against `bevanshelton-netizen/izakhono-builder` with labels:

- `self-hosted`
- `izakhono-owned`
- `linux`

Set `IZAKHONO_OWNED_RUNTIME=true` in the runner service environment. Never commit the registration token or any runner credential to the repository.

## Production acceptance

Node readiness is not the same thing as public LIVE status. Production acceptance additionally requires:

1. Super Engine candidate deployment.
2. Container health at `/health`.
3. HTTPS ingress acceptance against the configured production route.
4. Release receipt validation.
5. Backup/restore evidence.
6. Explicit promotion.

Until those checks produce evidence, the runtime must be described as **prepared** rather than LIVE.
