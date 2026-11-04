#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${NAV_COMPOSE_FILE:-infra/contabo/nav-compose.yml}"
BACKUP_ROOT="${NODE01_BACKUP_DIR:-/var/backups/izakhono-nav}"
HELPER_IMAGE="${NODE01_BACKUP_HELPER_IMAGE:-alpine:3.20}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_ID="nav-node01-$STAMP"
LOCK_FILE="${NODE01_BACKUP_LOCK:-/tmp/izakhono-nav-backup.lock}"
STAGING="$BACKUP_ROOT/.$BACKUP_ID.partial"
FINAL="$BACKUP_ROOT/$BACKUP_ID"

command -v docker >/dev/null || { echo "ERROR: docker is required" >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "ERROR: sha256sum is required" >&2; exit 1; }
command -v flock >/dev/null || { echo "ERROR: flock is required" >&2; exit 1; }
[[ -f "$COMPOSE_FILE" ]] || { echo "ERROR: compose file not found: $COMPOSE_FILE" >&2; exit 1; }
mkdir -p "$BACKUP_ROOT"
BACKUP_ROOT="$(cd "$BACKUP_ROOT" && pwd)"
chmod 0700 "$BACKUP_ROOT"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "ERROR: another NAV backup is running" >&2; exit 1; }
[[ ! -e "$FINAL" && ! -e "$STAGING" ]] || { echo "ERROR: backup path already exists" >&2; exit 1; }

docker image inspect "$HELPER_IMAGE" >/dev/null 2>&1 || {
  echo "ERROR: backup helper image is not present locally: $HELPER_IMAGE" >&2
  echo "Pull and verify the approved helper image before running this backup." >&2
  exit 1
}

VOLUME_NAMES="$(docker compose -f "$COMPOSE_FILE" config --format json | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const c=JSON.parse(s), v=c.volumes||{};
  const names=Object.values(v).map(x=>x.name).filter(Boolean);
  if(!names.length) process.exit(3);
  process.stdout.write([...new Set(names)].join("\n"));
});')"

mkdir -m 0700 "$STAGING"
cleanup() { [[ -d "$STAGING" ]] && rm -rf "$STAGING"; }
trap cleanup EXIT

cp "$COMPOSE_FILE" "$STAGING/nav-compose.yml"
cp infra/contabo/nav-Caddyfile "$STAGING/nav-Caddyfile"
printf '%s\n' "backup_id=$BACKUP_ID" "created_utc=$STAMP" "node=NODE01" "product=IZAKHONO NAV" "compose_file=$COMPOSE_FILE" "helper_image=$HELPER_IMAGE" "included=compose-config,caddyfile,caddy-named-volumes" "excluded=runtime-secrets,environment-files,application-source,host-system" > "$STAGING/backup-manifest.txt"

while IFS= read -r volume; do
  [[ -n "$volume" ]] || continue
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

(
  cd "$STAGING"
  sha256sum nav-compose.yml nav-Caddyfile backup-manifest.txt volume-*.tar.gz > SHA256SUMS
)
chmod 0600 "$STAGING"/*
mv "$STAGING" "$FINAL"
trap - EXIT
printf '[NAV BACKUP] created=%s\n' "$FINAL"
printf '[NAV BACKUP] verify with: (cd "%s" && sha256sum -c SHA256SUMS)\n' "$FINAL"
printf '[NAV BACKUP] secrets are intentionally excluded; protect any separate secret backup through the approved secrets manager.\n'
