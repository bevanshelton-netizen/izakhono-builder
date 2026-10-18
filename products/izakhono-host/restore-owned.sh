#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
ARCHIVE="${1:-}"
[[ -n "$ARCHIVE" && -f "$ARCHIVE" ]] || { echo "Usage: ./restore-owned.sh backups/izakhono-host-*.tar.gz" >&2; exit 1; }
[[ -f .env ]] || { echo ".env is required" >&2; exit 1; }

echo "WARNING: this replaces the current runtime state."
read -r -p "Type RESTORE to continue: " CONFIRM
[[ "$CONFIRM" == "RESTORE" ]] || { echo "Restore cancelled."; exit 1; }

CHECKSUM="${ARCHIVE}.sha256"
[[ -f "$CHECKSUM" ]] && sha256sum -c "$CHECKSUM"

docker compose --env-file .env -f docker-compose.owned.yml stop host-runtime >/dev/null
cat "$ARCHIVE" | docker compose --env-file .env -f docker-compose.owned.yml run --rm -T -v "$(pwd)/$ARCHIVE:/backup/archive.tar.gz:ro" host-runtime sh -c 'rm -rf /data/* && tar xzf /backup/archive.tar.gz -C /data'
docker compose --env-file .env -f docker-compose.owned.yml up -d host-runtime

echo "Restore complete; verify /health and customer acceptance evidence before declaring live."
