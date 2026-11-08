#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

EDGE_COMPOSE="${NAV_COMPOSE_FILE:-infra/contabo/nav-compose.yml}"
STACK_DIR="products/izakhono-nav/stack"
STACK_COMPOSE="$STACK_DIR/compose.yaml"
STACK_ENV="$STACK_DIR/.env"
STACK_ENV_FALLBACK="$STACK_DIR/.env.example"
BACKUP_ROOT="${NODE01_BACKUP_DIR:-/var/backups/izakhono-nav}"
HELPER_IMAGE="${NODE01_BACKUP_HELPER_IMAGE:-alpine:3.20}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_ID="nav-node01-$STAMP"
STAGING="$BACKUP_ROOT/.$BACKUP_ID.partial"
FINAL="$BACKUP_ROOT/$BACKUP_ID"

command -v docker >/dev/null || { echo "ERROR: docker is required" >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "ERROR: sha256sum is required" >&2; exit 1; }
command -v flock >/dev/null || { echo "ERROR: flock is required" >&2; exit 1; }
[[ -f "$EDGE_COMPOSE" && -f "$STACK_COMPOSE" ]] || { echo "ERROR: edge or owned-stack Compose file is missing" >&2; exit 1; }
mkdir -p "$BACKUP_ROOT"
BACKUP_ROOT="$(cd "$BACKUP_ROOT" && pwd)"
chmod 0700 "$BACKUP_ROOT"
LOCK_FILE="$BACKUP_ROOT/.backup.lock"
[[ ! -L "$LOCK_FILE" ]] || { echo "ERROR: backup lock must not be a symlink: $LOCK_FILE" >&2; exit 1; }
exec 9>>"$LOCK_FILE"
chmod 0600 "$LOCK_FILE"
flock -n 9 || { echo "ERROR: another NAV backup is running" >&2; exit 1; }
[[ ! -e "$FINAL" && ! -e "$STAGING" ]] || { echo "ERROR: backup path already exists" >&2; exit 1; }

docker image inspect "$HELPER_IMAGE" >/dev/null 2>&1 || {
  echo "ERROR: backup helper image is not present locally: $HELPER_IMAGE" >&2
  echo "Pull and verify the approved helper image before running this backup." >&2
  exit 1
}

ENV_FILE="$STACK_ENV"
[[ -f "$ENV_FILE" ]] || ENV_FILE="$STACK_ENV_FALLBACK"
set -a
source "$ENV_FILE"
set +a
RAW_DATA_DIR="${NAV_DATA_DIR:-./runtime-data}"
if [[ "$RAW_DATA_DIR" = /* ]]; then
  DATA_DIR="$RAW_DATA_DIR"
else
  DATA_DIR="$ROOT/$STACK_DIR/$RAW_DATA_DIR"
fi
[[ -d "$DATA_DIR" && ! -L "$DATA_DIR" ]] || { echo "ERROR: owned NAV runtime data directory is missing or symlinked: $DATA_DIR" >&2; exit 1; }
DATA_DIR="$(cd "$DATA_DIR" && pwd)"

volume_names() {
  local compose_file="$1"
  shift
  docker compose "$@" -f "$compose_file" config --format json | node -e '
    let input="";
    process.stdin.on("data",chunk=>input+=chunk).on("end",()=>{
      const config=JSON.parse(input), volumes=config.volumes||{};
      const names=Object.values(volumes).map(value=>value.name).filter(Boolean);
      process.stdout.write([...new Set(names)].join("\n"));
    });
  '
}
EDGE_VOLUMES="$(volume_names "$EDGE_COMPOSE")"
STACK_VOLUMES="$(volume_names "$STACK_COMPOSE" --env-file "$ENV_FILE")"
VOLUME_NAMES="$(printf '%s\n%s\n' "$EDGE_VOLUMES" "$STACK_VOLUMES" | sed '/^$/d' | sort -u)"
[[ -n "$VOLUME_NAMES" ]] || { echo "ERROR: no persistent NAV volumes resolved from Compose" >&2; exit 1; }

mkdir -m 0700 "$STAGING"
cleanup() { [[ -d "$STAGING" ]] && rm -rf "$STAGING"; }
trap cleanup EXIT

cp "$EDGE_COMPOSE" "$STAGING/nav-compose.yml"
cp infra/contabo/nav-Caddyfile "$STAGING/nav-Caddyfile"
cp "$STACK_COMPOSE" "$STAGING/owned-stack-compose.yaml"
cp "$STACK_DIR/Caddyfile" "$STAGING/owned-stack-Caddyfile"
cp "$STACK_DIR/martin.yaml" "$STAGING/owned-stack-martin.yaml"
cp "$STACK_DIR/style.json" "$STAGING/owned-stack-style.json"
cp products/izakhono-nav/runtime-manifest.json "$STAGING/runtime-manifest.json"

printf '%s\n' \
  "backup_id=$BACKUP_ID" \
  "created_utc=$STAMP" \
  "node=NODE01" \
  "product=IZAKHONO NAV" \
  "edge_compose=$EDGE_COMPOSE" \
  "owned_stack_compose=$STACK_COMPOSE" \
  "runtime_data_path=$DATA_DIR" \
  "helper_image=$HELPER_IMAGE" \
  "included=edge-config,owned-stack-config,all-compose-named-volumes,router-search-and-tile-runtime-data" \
  "excluded=runtime-secrets,environment-files,application-source,host-system" \
  > "$STAGING/backup-manifest.txt"

while IFS= read -r volume; do
  [[ -n "$volume" ]] || continue
  [[ "$volume" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || {
    echo "ERROR: unsafe Docker volume name from rendered Compose config: $volume" >&2
    exit 1
  }
  docker volume inspect "$volume" >/dev/null
  archive="$STAGING/volume-$volume.tar.gz"
  echo "[NAV BACKUP] archiving named volume: $volume"
  docker run --rm --network none --read-only \
    --mount "type=volume,src=$volume,dst=/source,readonly" \
    --mount "type=bind,src=$STAGING,dst=/backup" \
    "$HELPER_IMAGE" sh -ec "tar -czf '/backup/volume-$volume.tar.gz' -C /source ."
  [[ -s "$archive" ]] || { echo "ERROR: empty archive for $volume" >&2; exit 1; }
  printf 'volume=%s archive=%s\n' "$volume" "$(basename "$archive")" >> "$STAGING/backup-manifest.txt"
done <<< "$VOLUME_NAMES"

echo "[NAV BACKUP] archiving router graph, South Africa OSM extract and owned PMTiles"
docker run --rm --network none --read-only \
  --mount "type=bind,src=$DATA_DIR,dst=/source,readonly" \
  --mount "type=bind,src=$STAGING,dst=/backup" \
  "$HELPER_IMAGE" sh -ec "tar -czf /backup/runtime-data.tar.gz -C /source ."
[[ -s "$STAGING/runtime-data.tar.gz" ]] || { echo "ERROR: runtime-data archive is empty" >&2; exit 1; }

(
  cd "$STAGING"
  sha256sum nav-compose.yml nav-Caddyfile owned-stack-compose.yaml owned-stack-Caddyfile owned-stack-martin.yaml owned-stack-style.json runtime-manifest.json backup-manifest.txt runtime-data.tar.gz volume-*.tar.gz > SHA256SUMS
)
chmod 0600 "$STAGING"/*
mv "$STAGING" "$FINAL"
trap - EXIT
printf '[NAV BACKUP] created=%s\n' "$FINAL"
printf '[NAV BACKUP] verify with: bash infra/node01/verify-nav-backup.sh "%s"\n' "$FINAL"
printf '[NAV BACKUP] runtime secrets remain excluded; protect them separately through the approved secrets manager.\n'
