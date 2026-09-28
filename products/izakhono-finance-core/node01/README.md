# FINANCE CORE — NODE01 activation pack

This directory is the owned-primary deployment pack for IZAKHONO FINANCE CORE.

## Gate sequence

1. Copy `.env.example` to `.env` and replace every placeholder with unique secrets.
2. Generate a 32-byte data key, store its base64 representation at `./secrets/data-key.b64`, and restrict permissions.
3. Use distinct maker and checker actor IDs. One person/credential may not request and approve the same protected action.
4. Run `node ../ops/node01-preflight.mjs` with the production environment loaded.
5. Build and start with Docker Compose.
6. Verify `/health` locally on NODE01.
7. Configure EDGE/TLS to proxy the private loopback port. Do not expose port 8797 directly to the public internet.
8. Run backup and restore rehearsal before handling production financial data.
9. Run independent HTTPS and end-to-end acceptance verification before changing public status.

## Backup

`node ../ops/backup.mjs /data/backups`

The backup remains encrypted and receives a SHA-256 manifest.

## Restore

Restores are blocked unless `FINANCE_RESTORE_APPROVED=YES` is explicitly set. The restore utility verifies the backup checksum and creates a pre-restore safety copy where a current data file exists.

## Status

This pack makes NODE01 activation repeatable. It does not itself prove NODE01, TLS, backup/restore or public-live status.
