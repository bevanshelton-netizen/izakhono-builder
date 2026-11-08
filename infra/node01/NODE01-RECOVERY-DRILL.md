# NODE01 NAV Recovery Drill

## Run an archive integrity check

```bash
bash infra/node01/verify-nav-backup.sh /var/backups/izakhono-nav/nav-node01-<UTC_TIMESTAMP>
```

This validates edge and owned-stack configuration, every named-volume archive, the South Africa OSM/router/tile runtime-data archive, and SHA-256 coverage. It does not by itself prove a live application restore.

## Run an isolated restore drill

Ensure the approved helper and Caddy images are already present locally. The drill does not pull images and runs archive extraction and Caddy validation with Docker networking disabled.

```bash
docker image inspect alpine:3.20
docker image inspect caddy:2-alpine
bash infra/node01/node01-restore-drill.sh /var/backups/izakhono-nav/nav-node01-<UTC_TIMESTAMP>
```

The drill restores every named volume into newly created temporary Docker volumes, extracts runtime data into a temporary directory, and validates both public-edge and owned-web Caddy configurations offline. A cleanup trap removes all temporary targets. Production volumes and runtime directories are never mounted.

This verifies archive readability, extraction and Caddy syntax. It does not prove that PostgreSQL/Nominatim can start from the restored database, Valhalla can load its graph, Martin can serve the restored PMTiles, or public TLS/DNS will work. Those require a controlled isolated staging runtime.

## Off-node replication

A backup stored only on NODE01 does not protect against host or disk loss. After local verification, copy it to an independent protected destination using credentials held outside Git.

```bash
NODE01_BACKUP_REMOTE_DEST='backup-user@backup-host:/srv/izakhono-backups/nav' \
  bash infra/node01/replicate-nav-backup-offsite.sh \
  /var/backups/izakhono-nav/nav-node01-<UTC_TIMESTAMP>
```

The script verifies the local archive, copies without remote deletion, and verifies remote SHA-256 checksums. No remote retention deletion is automated.

## Full recovery acceptance

A full recovery test must restore into a separate owned runtime, then start and verify Nominatim, Valhalla, Martin, the NAV engine, the owned web gateway and the public Caddy edge. Test search, routing, tiles, PWA assets and offline tile retrieval. Record the exact backup ID, Git release, checksums, runtime identity, UTC time and operator.

No backup artifact, off-node copy or successful full-stack restore is verified from this chat. The procedure is committed but still requires NODE01 execution.
