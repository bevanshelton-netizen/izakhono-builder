#!/usr/bin/env bash
set -euo pipefail
umask 077

BACKUP_DIR="${1:-}"
[[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]] || { echo "Usage: $0 /path/to/nav-backup" >&2; exit 2; }
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
HELPER_IMAGE="${NODE01_BACKUP_HELPER_IMAGE:-alpine:3.20}"
CADDY_IMAGE="${NODE01_CADDY_IMAGE:-caddy:2-alpine}"
NAV_DOMAIN="${NAV_DOMAIN:-nav.izakhono.africa}"
DRILL_ID="nav-restore-drill-$(date -u +%Y%m%dT%H%M%SZ)-$$"
DATA_VOL="$DRILL_ID-data"
CONFIG_VOL="$DRILL_ID-config"
CREATED_VOLUMES=()

command -v docker >/dev/null || { echo "ERROR: docker is required" >&2; exit 1; }
command -v sha256sum >/dev/null || exit 1
command -v tar >/dev/null || exit 1
bash infra/node01/verify-nav-backup.sh "$BACKUP_DIR"

docker image inspect "$HELPER_IMAGE" >/dev/null 2>&1 || { echo "ERROR: helper image is not present locally: $HELPER_IMAGE" >&2; exit 1; }
docker image inspect "$CADDY_IMAGE" >/dev/null 2>&1 || { echo "ERROR: Caddy image is not present locally: $CADDY_IMAGE" >&2; exit 1; }

cleanup() {
  for volume in "${CREATED_VOLUMES[@]}"; do
    docker volume rm "$volume" >/dev/null 2>&1 || echo "WARNING: remove drill volume manually: $volume" >&2
  done
}
trap cleanup EXIT

docker volume create "$DATA_VOL" >/dev/null
CREATED_VOLUMES+=("$DATA_VOL")
docker volume create "$CONFIG_VOL" >/dev/null
CREATED_VOLUMES+=("$CONFIG_VOL")

restore_volume() {
  local source_name="$1" target_volume="$2"
  local archive
  archive="$(sed -n "s/^volume=$source_name archive=//p" "$BACKUP_DIR/backup-manifest.txt" | head -n 1)"
  [[ -n "$archive" && -s "$BACKUP_DIR/$archive" ]] || { echo "ERROR: missing archive for $source_name" >&2; return 1; }
  docker run --rm --network none --read-only \
    --mount "type=volume,src=$target_volume,dst=/restore" \
    --mount "type=bind,src=$BACKUP_DIR/$archive,dst=/backup/archive.tar.gz,readonly" \
    "$HELPER_IMAGE" sh -ec "tar -xzf /backup/archive.tar.gz -C /restore"
}

# Match the two persistent volumes declared by the current NAV Compose stack.
DATA_SOURCE="$(grep '^volume=.*nav-caddy-data' "$BACKUP_DIR/backup-manifest.txt" | head -n 1 | sed -n 's/^volume=\([^ ]*\).*/\1/p')"
CONFIG_SOURCE="$(grep '^volume=.*nav-caddy-config' "$BACKUP_DIR/backup-manifest.txt" | head -n 1 | sed -n 's/^volume=\([^ ]*\).*/\1/p')"
[[ -n "$DATA_SOURCE" && -n "$CONFIG_SOURCE" ]] || { echo "ERROR: expected Caddy volumes are not present in this backup" >&2; exit 1; }

echo "[RESTORE DRILL] restoring into isolated temporary volumes only"
restore_volume "$DATA_SOURCE" "$DATA_VOL"
restore_volume "$CONFIG_SOURCE" "$CONFIG_VOL"

echo "[RESTORE DRILL] validating restored Caddy configuration offline"
docker run --rm --network none \
  -e "NAV_DOMAIN=$NAV_DOMAIN" \
  --mount "type=bind,src=$BACKUP_DIR/nav-Caddyfile,dst=/etc/caddy/Caddyfile,readonly" \
  --mount "type=volume,src=$DATA_VOL,dst=/data,readonly" \
  --mount "type=volume,src=$CONFIG_VOL,dst=/config,readonly" \
  "$CADDY_IMAGE" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo "[RESTORE DRILL] PASS: archive extracted into isolated volumes and Caddyfile validated"
echo "[RESTORE DRILL] temporary volumes will now be removed; production volumes were never mounted or changed"
