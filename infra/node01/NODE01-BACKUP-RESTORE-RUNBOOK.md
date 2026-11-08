# IZAKHONO NAV — NODE01 Backup & Restore Readiness

## Backup scope

The backup covers both deployment layers:

- Public Caddy edge volumes: Caddy certificate and configuration state.
- Owned NAV stack volumes: Nominatim/PostgreSQL database and Nominatim flatnode. The internal web Caddy is stateless; its configuration is archived separately.
- The owned stack's bind-mounted runtime data: South Africa OpenStreetMap extract, Valhalla routing graph, and locally generated PMTiles.
- Edge and owned-stack Compose/Caddy/Martin configuration plus the runtime manifest.

The backup intentionally excludes `.env` files, credentials, application source, host operating system state, and external DNS/provider configuration. Application source is recoverable from the exact Git release. Runtime secrets must be protected separately through an approved secrets manager.

## Prepare NODE01

Run from the repository root on NODE01. Confirm the approved helper image is already present locally; the archive operation does not pull images.

```bash
docker image inspect alpine:3.20
sudo install -d -m 0700 -o "$USER" -g "$(id -gn)" /var/backups/izakhono-nav
NODE01_BACKUP_DIR=/var/backups/izakhono-nav \
  NODE01_BACKUP_HELPER_IMAGE=alpine:3.20 \
  bash infra/node01/node01-backup-nav.sh
```

The script resolves named volumes from both Compose files, archives them read-only, and archives the owned runtime-data directory. It uses a single-flight lock, writes to a private staging directory, creates SHA-256 checksums, and renames the staging directory only after the complete backup set is present. It does not stop, restart, or modify production containers.

## Verify a backup

```bash
bash infra/node01/verify-nav-backup.sh /var/backups/izakhono-nav/nav-node01-<UTC_TIMESTAMP>
```

The verifier checks required configuration, every named-volume archive, the runtime-data archive, archive readability, and exact checksum coverage. Treat any missing archive or checksum failure as a failed backup.

## Off-node replication

A backup on the same NODE01 disk is not disaster recovery. After local verification, replicate to an independent protected storage target:

```bash
NODE01_BACKUP_REMOTE_DEST='backup-user@backup-host:/srv/izakhono-backups/nav' \
  bash infra/node01/replicate-nav-backup-offsite.sh \
  /var/backups/izakhono-nav/nav-node01-<UTC_TIMESTAMP>
```

The SSH identity and destination must be provisioned outside Git. The script verifies local checksums, copies without remote deletion, and verifies the remote copy. Retention deletion is not automated.

## Isolated restore drill

```bash
bash infra/node01/node01-restore-drill.sh /var/backups/izakhono-nav/nav-node01-<UTC_TIMESTAMP>
```

The drill extracts every named-volume archive into newly created temporary Docker volumes, extracts runtime data into a temporary directory, and validates both Caddy configurations offline. A cleanup trap removes all temporary targets. It never mounts or changes production volumes.

This is an archive and configuration drill, not a full NAV application recovery test. It does not prove Nominatim database recovery, Valhalla service startup, public DNS, TLS renewal, or end-to-end navigation after restoration.

## Full recovery acceptance

Before claiming disaster recovery is operational, complete a separately controlled recovery exercise on an isolated owned runtime:

1. Verify the backup and off-node copy.
2. Restore the owned runtime data and named volumes into isolated targets.
3. Start Nominatim, Valhalla, Martin, the NAV engine and web gateway using the exact release.
4. Verify search, road routing, owned tiles, PWA assets and offline route-tile retrieval.
5. Validate public HTTPS on a controlled staging hostname.
6. Record backup ID, Git release, checksums, restore results, runtime identity, UTC time and operator.

No backup artifact, off-node copy, or successful full-stack restore has been verified from this chat. The scripts and runbook are committed; execution still requires NODE01 runtime access.
