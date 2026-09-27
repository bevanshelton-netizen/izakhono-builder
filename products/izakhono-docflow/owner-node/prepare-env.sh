#!/usr/bin/env bash
set -euo pipefail

ENV_DIR=/etc/izakhono/apps
ENV_FILE="$ENV_DIR/izakhono-docflow.env"

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

mkdir -p "$ENV_DIR"
chmod 700 "$ENV_DIR"

existing_secret=""
if [ -f "$ENV_FILE" ]; then
  existing_secret="$(awk -F= '$1=="DOCFLOW_ADMIN_SECRET"{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" || true)"
fi

if [ -z "$existing_secret" ]; then
  if command -v openssl >/dev/null 2>&1; then
    existing_secret="$(openssl rand -hex 32)"
  else
    existing_secret="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)"
  fi
fi

tmp="$(mktemp)"
cat >"$tmp" <<EOF
APP_ENV=production
IZAKHONO_DOCFLOW_DB=/app/data/docflow.sqlite
DOCFLOW_ADMIN_SECRET=$existing_secret
EOF

# Optional adapters are intentionally not invented. Add only when the owned
# SUPER AI / FLOWIQ runtime endpoints and credentials are verified.
if [ -f "$ENV_FILE" ]; then
  for key in SUPER_AI_URL SUPER_AI_TOKEN FLOWIQ_URL FLOWIQ_TOKEN; do
    value="$(awk -F= -v k="$key" '$1==k{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" || true)"
    [ -z "$value" ] || printf '%s=%s\n' "$key" "$value" >>"$tmp"
  done
fi

install -m 600 -o root -g root "$tmp" "$ENV_FILE"
rm -f "$tmp"

echo "IZAKHONO_DOCFLOW_ENV=READY"
echo "ENV_FILE=$ENV_FILE"
echo "ADMIN_SECRET=PRESENT_NOT_PRINTED"
