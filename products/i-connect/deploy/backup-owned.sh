#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${I_CONNECT_APP_DIR:-/opt/izakhono/i-connect}"
BACKUP_DIR="${I_CONNECT_BACKUP_DIR:-/var/lib/i-connect-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/i-connect-${STAMP}.tar.gz"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

if [[ ! -d "$APP_DIR/products/i-connect" ]]; then
  echo "ERROR: I-CONNECT deployment directory not found: $APP_DIR" >&2
  exit 1
fi

# Back up deployment metadata and persistent edge configuration, but never the live .env file.
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
mkdir -p "$tmpdir/products/i-connect/deploy" "$tmpdir/metadata"

cp -a "$APP_DIR/products/i-connect/deploy/." "$tmpdir/products/i-connect/deploy/"
rm -f "$tmpdir/products/i-connect/deploy/.env"

if [[ -d /var/lib/docker/volumes/i-connect_caddy_data/_data ]]; then
  mkdir -p "$tmpdir/caddy-data"
  cp -a /var/lib/docker/volumes/i-connect_caddy_data/_data/. "$tmpdir/caddy-data/"
fi

if [[ -d /var/lib/docker/volumes/i-connect_caddy_config/_data ]]; then
  mkdir -p "$tmpdir/caddy-config"
  cp -a /var/lib/docker/volumes/i-connect_caddy_config/_data/. "$tmpdir/caddy-config/"
fi

{
  echo "created_utc=$STAMP"
  echo "app_dir=$APP_DIR"
  echo "backup=$OUT"
  git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || true
  docker compose -f "$APP_DIR/products/i-connect/deploy/docker-compose.owned.yml" ps 2>/dev/null || true
} > "$tmpdir/metadata/backup-manifest.txt"

( cd "$tmpdir" && tar -czf "$OUT" . )
chmod 600 "$OUT"

echo "I-CONNECT owned backup created: $OUT"
echo "Secrets excluded: deploy/.env"
