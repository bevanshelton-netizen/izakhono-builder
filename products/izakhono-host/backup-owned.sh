#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$BACKUP_DIR/izakhono-host-$STAMP.tar.gz"

[[ -f .env ]] || { echo ".env is required" >&2; exit 1; }

echo "Creating runtime data backup..."
docker compose --env-file .env -f docker-compose.owned.yml exec -T host-runtime sh -c 'tar czf - -C /data .' > "$ARCHIVE"

test -s "$ARCHIVE"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
echo "Backup verified: $ARCHIVE"
