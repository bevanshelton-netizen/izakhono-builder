#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${1:-}"
[[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" ]] || { echo "Usage: $0 /path/to/nav-backup" >&2; exit 2; }
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd)"
cd "$ROOT"
HELPER_IMAGE="${NODE01_BACKUP_HELPER_IMAGE:-alpine:3.20}"
CADDY_IMAGE="${NODE01_CADDY_IMAGE:-caddy:2-alpine}"
NAV_DOMAIN="${NAV_DOMAIN:-nav.izakhono.africa}"
DRILL_ID="nav-restore-drill-$(date -u +%Y%m%dT%H%M%SZ)-$$"
CREATED_VOLUMES=()
DRILL_DATA_DIR="$(mktemp -d "${TMPDIR:-/tmp}/$DRILL_ID.XXXXXX")"

command -v docker >/dev/null || { echo "ERROR: docker is required" >&2; exit 1; }
command -v tar >/dev/null || exit 1
bash infra/node01/verify-nav-backup.sh "$BACKUP_DIR"
docker image inspect "$HELPER_IMAGE" >/dev/null 2>&1 || { echo "ERROR: helper image is not present locally: $HELPER_IMAGE" >&2; exit 1; }
docker image inspect "$CADDY_IMAGE" >/dev/null 2>&1 || { echo "ERROR: Caddy image is not present locally: $CADDY_IMAGE" >&2; exit 1; }

cleanup() {
  for volume in "${CREATED_VOLUMES[@]}"; do
    docker volume rm "$volume" >/dev/null 2>&1 || echo "WARNING: remove drill volume manually: $volume" >&2
  done
  rm -rf "$DRILL_DATA_DIR"
}
trap cleanup EXIT

restore_volume() {
  local source_name="$1" archive="$2" target_volume="$3"
  docker volume create "$target_volume" >/dev/null
  CREATED_VOLUMES+=("$target_volume")
  docker run --rm --network none --read-only \
    --mount "type=volume,src=$target_volume,dst=/restore" \
    --mount "type=bind,src=$BACKUP_DIR/$archive,dst=/backup/archive.tar.gz,readonly" \
    "$HELPER_IMAGE" sh -ec "tar -xzf /backup/archive.tar.gz -C /restore"
  echo "[RESTORE DRILL] restored $source_name into isolated volume $target_volume"
}

echo "[RESTORE DRILL] restoring every named volume into isolated temporary volumes"
index=0
while IFS= read -r line; do
  [[ "$line" == volume=* ]] || continue
  if [[ ! "$line" =~ ^volume=([A-Za-z0-9_.-]+)[[:space:]]archive=(volume-[A-Za-z0-9_.-]+\.tar\.gz)$ ]]; then
    echo "ERROR: unsafe volume archive entry: $line" >&2
    exit 1
  fi
  source_name="${BASH_REMATCH[1]}"
  archive="${BASH_REMATCH[2]}"
  target_volume="$DRILL_ID-v$index"
  restore_volume "$source_name" "$archive" "$target_volume"
  index=$((index + 1))
done < "$BACKUP_DIR/backup-manifest.txt"
(( index >= 4 )) || { echo "ERROR: expected all edge and owned-stack volumes to restore" >&2; exit 1; }

echo "[RESTORE DRILL] extracting OSM, router graph and PMTiles into an isolated temporary directory"
docker run --rm --network none --read-only \
  --mount "type=bind,src=$DRILL_DATA_DIR,dst=/restore" \
  --mount "type=bind,src=$BACKUP_DIR/runtime-data.tar.gz,dst=/backup/runtime-data.tar.gz,readonly" \
  "$HELPER_IMAGE" sh -ec "tar -xzf /backup/runtime-data.tar.gz -C /restore"
for required in osm router tiles; do
  [[ -d "$DRILL_DATA_DIR/$required" ]] || { echo "ERROR: restored runtime data is missing $required/" >&2; exit 1; }
done

echo "[RESTORE DRILL] validating restored public Caddy configuration offline"
docker run --rm --network none \
  -e "NAV_DOMAIN=$NAV_DOMAIN" \
  --mount "type=bind,src=$BACKUP_DIR/nav-Caddyfile,dst=/etc/caddy/Caddyfile,readonly" \
  --entrypoint caddy "$CADDY_IMAGE" validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo "[RESTORE DRILL] validating restored owned-web Caddy configuration offline"
docker run --rm --network none \
  --mount "type=bind,src=$BACKUP_DIR/owned-stack-Caddyfile,dst=/etc/caddy/Caddyfile,readonly" \
  --entrypoint caddy "$CADDY_IMAGE" validate --config /etc/caddy/Caddyfile --adapter caddyfile

echo "[RESTORE DRILL] PASS: all named volumes and runtime data extracted into isolated targets; both Caddy configurations validated"
echo "[RESTORE DRILL] this is an isolated archive/configuration drill, not a full live application recovery test"
echo "[RESTORE DRILL] temporary volumes and extracted runtime data will now be removed; production volumes were never mounted or changed"
