#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${I_CONNECT_APP_DIR:-/opt/izakhono/i-connect}"
BACKUP_DIR="${I_CONNECT_BACKUP_DIR:-/var/lib/i-connect-backups}"
ARCHIVE="${1:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: run as root." >&2
  exit 1
fi
if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "Usage: $0 /var/lib/i-connect-backups/i-connect-<timestamp>.tar.gz" >&2
  exit 1
fi
case "$ARCHIVE" in
  "$BACKUP_DIR"/*.tar.gz) ;;
  *) echo "ERROR: restore archive must be inside $BACKUP_DIR" >&2; exit 1 ;;
esac

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

tar -xzf "$ARCHIVE" -C "$work"

if [[ -f "$work/products/i-connect/deploy/.env" ]]; then
  echo "ERROR: backup contains a forbidden .env file." >&2
  exit 1
fi

mkdir -p "$APP_DIR/products/i-connect/deploy"
cp -a "$work/products/i-connect/deploy/." "$APP_DIR/products/i-connect/deploy/"

# Persistent Caddy data/config are restored only when present in the archive.
if [[ -d "$work/caddy-data" ]]; then
  mkdir -p /var/lib/docker/volumes/i-connect_caddy_data/_data
  cp -a "$work/caddy-data/." /var/lib/docker/volumes/i-connect_caddy_data/_data/
fi
if [[ -d "$work/caddy-config" ]]; then
  mkdir -p /var/lib/docker/volumes/i-connect_caddy_config/_data
  cp -a "$work/caddy-config/." /var/lib/docker/volumes/i-connect_caddy_config/_data/
fi

chmod 600 "$APP_DIR/products/i-connect/deploy/.env" 2>/dev/null || true

echo "I-CONNECT deployment metadata restored from: $ARCHIVE"
echo "Secrets were not restored; restore/verify deploy/.env separately before starting production services."
echo "Run preflight-owned.sh before bringing the stack back online."
