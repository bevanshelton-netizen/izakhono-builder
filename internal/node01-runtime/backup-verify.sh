#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT="${NODE01_BACKUP_ROOT:-/var/backups/izakhono-node01}"
LATEST="$(find "$BACKUP_ROOT" -maxdepth 1 -type f -name '*.sha256' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || true)"

if [[ -z "$LATEST" ]]; then
  echo "[STOP] No backup manifest found."
  exit 2
fi

cd "$(dirname "$LATEST")"
sha256sum -c "$(basename "$LATEST")"
echo "[PASS] Latest NODE01 backup integrity verified: $LATEST"
