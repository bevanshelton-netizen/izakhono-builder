# CONNECTA Backup and Restore

CONNECTA public cutover is blocked until a backup has been created and a non-destructive restore test has passed on the target environment.

## Backup

From the CONNECTA repository directory:

```bash
CONNECTA_COMPOSE_PROJECT=izakhono-connecta bash ops/backup.sh /var/backups/connecta
```

The backup bundle contains:

- `connecta-db.dump` — PostgreSQL custom-format dump;
- `connecta-media.tar.gz` — media-volume archive;
- `SHA256SUMS` — integrity checks;
- `manifest.json` — commit, sizes and media-file count.

No passwords, owner keys or authentication secrets are intentionally written into the bundle.

## Non-destructive restore proof

```bash
CONNECTA_COMPOSE_PROJECT=izakhono-connecta bash ops/restore-test.sh /var/backups/connecta/connecta-<timestamp>
```

This restores the database into a temporary database and the media archive into a temporary Docker volume, validates the CONNECTA schema and media count, then destroys the temporary targets. Production remains untouched.

## Production restore

A real restore is intentionally guarded:

```bash
CONNECTA_COMPOSE_PROJECT=izakhono-connecta bash ops/restore.sh /var/backups/connecta/connecta-<timestamp> --confirm-destructive
```

This stops the web/engine services, recreates the CONNECTA database, restores the media volume, restarts the stack and requires the full `/health` gate to pass.

## Cutover rule

A backup file existing is not enough. **Both backup checksum verification and the non-destructive restore proof must pass** before CONNECTA can satisfy its recovery cutover gate.
