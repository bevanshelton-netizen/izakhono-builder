#!/usr/bin/env bash
set -euo pipefail
ENV_DIR=/etc/izakhono/apps
ENV_FILE="$ENV_DIR/izakhono-sign.env"
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi
mkdir -p "$ENV_DIR"; chmod 700 "$ENV_DIR"

read_key(){ [ -f "$ENV_FILE" ] && awk -F= -v k="$1" '$1==k{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" || true; }
make_secret(){ if command -v openssl >/dev/null 2>&1; then openssl rand -hex 32; else python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
fi; }

api="$(read_key SIGN_API_TOKEN)"; link="$(read_key SIGN_LINK_SECRET)"
[ -n "$api" ] || api="$(make_secret)"
[ -n "$link" ] || link="$(make_secret)"
tmp="$(mktemp)"
cat >"$tmp" <<EOF
IZAKHONO_SIGN_DB=/app/data/sign.sqlite
SIGN_API_TOKEN=$api
SIGN_LINK_SECRET=$link
SIGN_LINK_DAYS=30
EOF
if [ -f "$ENV_FILE" ]; then
  for key in DOCFLOW_URL DOCFLOW_SERVICE_TOKEN SIGN_PUBLIC_BASE_URL SIGN_MAIL_URL SIGN_MAIL_TOKEN SIGN_AUDIT_IP_SALT; do
    value="$(awk -F= -v k="$key" '$1==k{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" || true)"
    [ -z "$value" ] || printf '%s=%s\n' "$key" "$value" >>"$tmp"
  done
fi
install -m 600 -o root -g root "$tmp" "$ENV_FILE"; rm -f "$tmp"
echo "IZAKHONO_SIGN_ENV=READY"; echo "ENV_FILE=$ENV_FILE"; echo "OWNER_CREDENTIALS=PRESENT_NOT_PRINTED"
