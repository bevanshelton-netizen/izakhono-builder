# NODE01 NAV Recovery Drill

## Run an archive integrity check

```bash
bash infra/node01/verify-nav-backup.sh /var/backups/izakhono-nav/nav-node01-<UTC_TIMESTAMP>
```

This validates the manifest, checksums, and gzip/tar archive readability. It is not an application restore test.

## Run an isolated Caddy restore drill

First ensure the approved helper and Caddy images are already present locally. The drill does not pull images and runs with Docker networking disabled.

```bash
docker image inspect alpine:3.20
docker image inspect caddy:2-alpine
bash infra/node01/node01-restore-drill.sh /var/backups/izakhono-nav/nav-node01-<UTC_TIMESTAMP>
```

The drill creates uniquely named temporary Docker volumes, extracts only the two Caddy volumes into those isolated volumes, and runs Caddy's configuration validator offline against the archived Caddyfile. A trap removes the temporary volumes on exit. The production volumes are never mounted.

This tests archive extraction and Caddy configuration parsing. It does not prove that public TLS renewal, DNS, external connectivity, or a complete production startup will work. Those require a controlled, separate staging environment with network access.

## Off-node replication

A backup stored only on NODE01 does not protect against host or disk loss. Copy only after checksum verification, using an approved encrypted remote destination and credentials stored outside the repository. Example pattern (configure the destination and SSH identity in NODE01's protected environment):

```bash
rsync -a --partial --chmod=F600,D700 /var/backups/izakhono-nav/nav-node01-<UTC_TIMESTAMP>/ "$NODE01_BACKUP_REMOTE_DEST/"
```

Do not put credentials, private keys, tokens, or remote host secrets in Git. Verify checksums again at the destination. Retention and remote destination must be selected according to the actual storage capacity and recovery objectives; no retention deletion is automated here.

## Evidence

Record backup ID, checksum result, restore-drill result, NODE01 hostname, UTC time, image versions, and operator. Never mark recovery readiness complete until a drill has passed and a second copy has been verified off-node.
