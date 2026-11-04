# IZAKHONO NAV — NODE01 Backup & Restore Readiness

## Current scope

The Compose stack declares two persistent Caddy volumes: `nav-caddy-data` and `nav-caddy-config`. NAV itself is currently stateless at the container-volume layer. The backup script resolves the actual Docker volume names from the rendered Compose configuration rather than assuming Docker's project prefix.

The backup includes:
- Resolved named volumes declared by `infra/contabo/nav-compose.yml`.
- The Compose file and Caddyfile used to define the deployment.
- A manifest and SHA-256 checksums.

It intentionally excludes runtime secrets, environment files, application source, host operating system state, and external DNS/provider configuration. Keep secrets in an approved secrets manager and protect them separately.

## Prepare NODE01

Run from the repository root on NODE01. Confirm the approved helper image is already present locally; the script does not pull images or require network access for the archive operation.

```bash
docker image inspect alpine:3.20
sudo install -d -m 0700 -o "$USER" -g "$(id -gn)" /var/backups/izakhono-nav
NODE01_BACKUP_DIR=/var/backups/izakhono-nav \
  NODE01_BACKUP_HELPER_IMAGE=alpine:3.20 \
  bash infra/node01/node01-backup-nav.sh
```

The script uses a single-flight lock, writes into a private staging directory, archives named volumes read-only, generates checksums, and renames the staging directory only after the archive set is complete. It does not stop, restart, or modify production containers.

## Verify a backup

```bash
cd /var/backups/izakhono-nav/nav-node01-<UTC_TIMESTAMP>
sha256sum -c SHA256SUMS
cat backup-manifest.txt
```

Treat any checksum failure, missing archive, or unexpected volume list as a failed backup. Copy verified backups to a separate protected storage location; a backup on the same NODE01 disk is not disaster recovery.

## Consistency and restore boundary

This is a best-effort online archive. Caddy may write certificate or state data while a volume is being archived, so the result is not guaranteed to be application-consistent. Before treating this as a production recovery point, conduct an isolated restore drill using copies of the volumes and validate Caddy startup and TLS state without touching live volumes.

No automated restore script is provided at this stage. Do not extract an archive over a live Docker volume or replace production volumes without a separately reviewed maintenance procedure, a verified pre-restore backup, and explicit operator approval.

## Recovery sequence (controlled)

1. Identify a backup directory and verify every checksum.
2. Confirm the exact Compose project and resolved volume names on the target.
3. Restore into newly named isolated test volumes, never the live volumes.
4. Start a temporary isolated Caddy test instance with the backed-up configuration.
5. Verify Caddy loads, expected certificate state is present, and no secrets are exposed.
6. Record the drill outcome, tested backup ID, timestamps, and any gaps.
7. Only after a successful drill, prepare a separately approved production recovery change.

## Status and claim boundaries

The script and runbook are committed to GitHub. They have not been executed on NODE01 from this chat. No backup artifact, off-node copy, or successful restore drill is currently verified. Do not describe NAV backups as operational until NODE01 execution and checksum verification are evidenced.
