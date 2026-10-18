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
docker run --rm \
  -v izakhonohost_host-runtime-data:/source:ro \
  -v "$BACKUP_DIR":/backup \
  alpine:3.20 sh -c "tar czf /backup/$(basename "$ARCHIVE") -C /source ."

test -s "$ARCHIVE"
sha256sum "$ARCHIVE" > "$ARCHIVE.sha256"
echo "Backup verified: $ARCHIVE"
