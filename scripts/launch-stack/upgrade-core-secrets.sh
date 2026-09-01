#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then echo 'Run as root (sudo).'; exit 1; fi
ENV_FILE=/opt/izakhono/launch-stack/.env
[ -f "$ENV_FILE" ] || { echo 'Launch Stack is not initialized.'; exit 1; }
command -v openssl >/dev/null

umask 077
changed=0
if ! grep -q '^IZAKHONO_CORE_JWT_SECRET=' "$ENV_FILE"; then
  printf 'IZAKHONO_CORE_JWT_SECRET=%s\n' "$(openssl rand -hex 48)" >> "$ENV_FILE"
  changed=1
fi
if ! grep -q '^IZAKHONO_CORE_ADMIN_TOKEN=' "$ENV_FILE"; then
  printf 'IZAKHONO_CORE_ADMIN_TOKEN=%s\n' "$(openssl rand -hex 48)" >> "$ENV_FILE"
  changed=1
fi
if ! grep -q '^IZAKHONO_CORE_ALLOWED_ORIGINS=' "$ENV_FILE"; then
  printf 'IZAKHONO_CORE_ALLOWED_ORIGINS=\n' >> "$ENV_FILE"
  changed=1
fi
chmod 600 "$ENV_FILE"

if [ "$changed" -eq 1 ]; then
  echo '[PASS] Missing IZAKHONO Core secrets were added without rotating existing Launch Stack credentials.'
else
  echo '[PASS] IZAKHONO Core secrets already exist; nothing changed.'
fi
