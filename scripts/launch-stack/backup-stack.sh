#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then echo 'Run as root (sudo).'; exit 1; fi
ENV_FILE=/opt/izakhono/launch-stack/.env
[ -f "$ENV_FILE" ] || { echo 'Launch stack is not initialized.'; exit 1; }
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEST="/opt/izakhono/backups/$STAMP"
mkdir -p "$DEST" /opt/izakhono/evidence
umask 077

docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" izakhono-postgres \
  pg_dumpall -U "$POSTGRES_USER" | gzip -9 > "$DEST/postgres-all.sql.gz"

tar -C /opt/izakhono -czf "$DEST/control-plane.tgz" launch-stack/Caddyfile launch-stack/sites state secrets evidence

cd /opt/izakhono/launch-stack
# Pause mutable local object services only while their volumes are snapshotted.
docker compose stop core registry >/dev/null
restart_services() { docker compose start core registry >/dev/null 2>&1 || true; }
trap restart_services EXIT

docker run --rm -v izakhono_core_storage:/data:ro -v "$DEST":/backup alpine:3.22 \
  tar -C /data -czf /backup/core-storage.tgz .
docker run --rm -v izakhono_registry_data:/data:ro -v "$DEST":/backup alpine:3.22 \
  tar -C /data -czf /backup/registry-data.tgz .

restart_services
trap - EXIT

(
  cd "$DEST"
  sha256sum postgres-all.sql.gz control-plane.tgz core-storage.tgz registry-data.tgz > SHA256SUMS
)
chmod -R go-rwx "$DEST"

echo "[PASS] Backup created at $DEST"
echo '[PASS] PostgreSQL, Core object storage, control-plane state and retained registry images are included.'
echo 'This is a same-host backup. Commercial disaster recovery still requires an encrypted off-host copy and a tested restore.'
