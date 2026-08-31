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
mkdir -p "$DEST"
umask 077

docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" izakhono-postgres \
  pg_dumpall -U "$POSTGRES_USER" | gzip -9 > "$DEST/postgres-all.sql.gz"

tar -C /opt/izakhono -czf "$DEST/control-plane.tgz" launch-stack/Caddyfile launch-stack/sites state secrets

cd /opt/izakhono/launch-stack
docker compose stop registry >/dev/null
docker run --rm -v izakhono_registry_data:/data:ro -v "$DEST":/backup alpine:3.22 \
  tar -C /data -czf /backup/registry-data.tgz .
docker compose start registry >/dev/null

(
  cd "$DEST"
  sha256sum postgres-all.sql.gz control-plane.tgz registry-data.tgz > SHA256SUMS
)
chmod -R go-rwx "$DEST"

echo "[PASS] Backup created at $DEST"
echo 'This is a same-host backup. Commercial disaster recovery still requires an encrypted off-host copy and a tested restore.'
