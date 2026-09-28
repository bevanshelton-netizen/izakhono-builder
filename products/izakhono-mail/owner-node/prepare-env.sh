#!/usr/bin/env bash
set -euo pipefail
ENV_DIR=/etc/izakhono/apps
ENV_FILE="$ENV_DIR/izakhono-mail.env"
if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi
mkdir -p "$ENV_DIR"; chmod 700 "$ENV_DIR"
existing=""
if [ -f "$ENV_FILE" ]; then existing="$(awk -F= '$1=="MAIL_API_TOKEN"{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" || true)"; fi
if [ -z "$existing" ]; then
  if command -v openssl >/dev/null 2>&1; then existing="$(openssl rand -hex 32)"; else existing="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)"; fi
fi
tmp="$(mktemp)"
cat >"$tmp" <<EOF
IZAKHONO_MAIL_DB=/app/data/mail.sqlite
MAIL_API_TOKEN=$existing
MAIL_SMTP_STARTTLS=true
MAIL_SMTP_SECURE=false
EOF
if [ -f "$ENV_FILE" ]; then
  for key in MAIL_SMTP_HOST MAIL_SMTP_PORT MAIL_SMTP_SECURE MAIL_SMTP_STARTTLS MAIL_SMTP_USER MAIL_SMTP_PASSWORD MAIL_FROM_EMAIL MAIL_FROM_NAME MAIL_SMTP_TIMEOUT_MS; do
    value="$(awk -F= -v k="$key" '$1==k{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" || true)"
    [ -z "$value" ] || printf '%s=%s\n' "$key" "$value" >>"$tmp"
  done
fi
install -m 600 -o root -g root "$tmp" "$ENV_FILE"; rm -f "$tmp"
echo "IZAKHONO_MAIL_ENV=READY"; echo "ENV_FILE=$ENV_FILE"; echo "OWNER_CREDENTIAL=PRESENT_NOT_PRINTED"
