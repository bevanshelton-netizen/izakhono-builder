#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo 'Run as root (sudo).'
  exit 1
fi

SLUG="${1:-}"
if [[ ! "$SLUG" =~ ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$ ]]; then
  echo 'Usage: provision-project-db.sh <safe-project-slug>'
  exit 2
fi

ENV_FILE=/opt/izakhono/launch-stack/.env
[ -f "$ENV_FILE" ] || { echo 'Launch stack is not initialized.'; exit 1; }
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

DB_SAFE="${SLUG//-/_}"
DB_NAME="app_${DB_SAFE}"
DB_USER="app_${DB_SAFE}"
SECRET_FILE="/opt/izakhono/secrets/${SLUG}.db.env"

if [ -e "$SECRET_FILE" ]; then
  echo "Database secret file already exists for $SLUG; refusing silent credential rotation."
  exit 1
fi

DB_PASSWORD="$(openssl rand -hex 32)"
EXISTS="$(docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" izakhono-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "select 1 from pg_roles where rolname='${DB_USER}'" || true)"
if [ "$EXISTS" = 1 ]; then
  echo "Database role already exists for $SLUG; refusing to overwrite it."
  exit 1
fi

docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" izakhono-postgres \
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';" \
  -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >/dev/null

umask 077
cat > "$SECRET_FILE" <<EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@izakhono-postgres:5432/${DB_NAME}
DB_HOST=izakhono-postgres
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
EOF
chmod 600 "$SECRET_FILE"

echo "[PASS] Isolated PostgreSQL database provisioned for $SLUG."
echo "Credentials were written only to $SECRET_FILE and were not printed."
