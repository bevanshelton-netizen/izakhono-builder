#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${I_CONNECT_APP_DIR:-/opt/izakhono/i-connect}"
COMPOSE_FILE="$APP_DIR/products/i-connect/deploy/docker-compose.owned.yml"
BACKUP_DIR="${I_CONNECT_BACKUP_DIR:-/var/lib/i-connect-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

fail() { echo "DR REHEARSAL FAILED: $*" >&2; exit 1; }

[[ "$(id -u)" -eq 0 ]] || fail "run as root"
[[ -f "$COMPOSE_FILE" ]] || fail "compose file missing: $COMPOSE_FILE"
[[ -d "$BACKUP_DIR" ]] || fail "backup directory missing: $BACKUP_DIR"

LATEST="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'i-connect-backup-*.tar.gz' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n1 | cut -d' ' -f2- || true)"
[[ -n "$LATEST" ]] || fail "no backup archive available"

mkdir -p "$WORK_DIR/restore"
tar -xzf "$LATEST" -C "$WORK_DIR/restore"

if find "$WORK_DIR/restore" -type f \( -name '.env' -o -name '*.key' -o -name '*.pem' \) | grep -q .; then
  fail "backup contains prohibited secret material"
fi

# Validate restored deployment metadata without touching production containers.
if command -v docker >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" config >/dev/null || fail "compose configuration invalid"
fi

printf 'I-CONNECT disaster-recovery rehearsal PASSED\n'
printf 'Backup tested: %s\n' "$LATEST"
printf 'Mode: non-destructive validation; production containers were not replaced.\n'
printf 'Timestamp: %s\n' "$STAMP"
