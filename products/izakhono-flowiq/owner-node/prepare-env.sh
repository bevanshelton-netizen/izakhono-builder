#!/usr/bin/env bash
set -euo pipefail

ENV_DIR=/etc/izakhono/apps
ENV_FILE="$ENV_DIR/izakhono-flowiq.env"

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

mkdir -p "$ENV_DIR"
chmod 700 "$ENV_DIR"

existing_token=""
if [ -f "$ENV_FILE" ]; then
  existing_token="$(awk -F= '$1=="FLOWIQ_TOKEN"{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" || true)"
fi

if [ -z "$existing_token" ]; then
  if command -v openssl >/dev/null 2>&1; then
    existing_token="$(openssl rand -hex 32)"
  else
    existing_token="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)"
  fi
fi

tmp="$(mktemp)"
cat >"$tmp" <<EOF
IZAKHONO_FLOWIQ_DB=/app/data/flowiq.sqlite
FLOWIQ_TOKEN=$existing_token
EOF

if [ -f "$ENV_FILE" ]; then
  for key in FLOWIQ_DELIVERY_URL FLOWIQ_DELIVERY_TOKEN FLOWIQ_CRM_URL FLOWIQ_CRM_TOKEN FLOWIQ_TASKS_URL FLOWIQ_TASKS_TOKEN; do
    value="$(awk -F= -v k="$key" '$1==k{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" || true)"
    [ -z "$value" ] || printf '%s=%s\n' "$key" "$value" >>"$tmp"
  done
fi

install -m 600 -o root -g root "$tmp" "$ENV_FILE"
rm -f "$tmp"

echo "IZAKHONO_FLOWIQ_ENV=READY"
echo "ENV_FILE=$ENV_FILE"
echo "OWNER_CREDENTIAL=PRESENT_NOT_PRINTED"
