#!/usr/bin/env bash
set -euo pipefail
ENV_DIR=/etc/izakhono/apps
ENV_FILE="$ENV_DIR/izakhono-crm.env"
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi
mkdir -p "$ENV_DIR"; chmod 700 "$ENV_DIR"

read_key(){ [ -f "$ENV_FILE" ] && awk -F= -v k="$1" '$1==k{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" || true; }
make_secret(){ if command -v openssl >/dev/null 2>&1; then openssl rand -hex 32; else python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
fi; }

admin="$(read_key CRM_ADMIN_TOKEN)"; ingest="$(read_key CRM_INGEST_TOKEN)"
[ -n "$admin" ] || admin="$(make_secret)"
[ -n "$ingest" ] || ingest="$(make_secret)"
tmp="$(mktemp)"
cat >"$tmp" <<EOF
CRM_DATA_FILE=/data/crm.json
CRM_ALLOW_INSECURE_LOCAL=false
CRM_ADMIN_TOKEN=$admin
CRM_INGEST_TOKEN=$ingest
EOF
if [ -f "$ENV_FILE" ]; then
  for key in CRM_STAFF_JSON CRM_STAFF_FILE; do
    value="$(awk -F= -v k="$key" '$1==k{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" || true)"
    [ -z "$value" ] || printf '%s=%s\n' "$key" "$value" >>"$tmp"
  done
fi
install -m 600 -o root -g root "$tmp" "$ENV_FILE"; rm -f "$tmp"
echo "IZAKHONO_CRM_ENV=READY"; echo "ENV_FILE=$ENV_FILE"; echo "OWNER_CREDENTIALS=PRESENT_NOT_PRINTED"
