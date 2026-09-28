#!/usr/bin/env bash
set -euo pipefail

ENV_DIR=/etc/izakhono/apps
ENV_FILE="$ENV_DIR/izakhono-tasks.env"

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

mkdir -p "$ENV_DIR"
chmod 700 "$ENV_DIR"

read_key(){
  local key="$1"
  if [ -f "$ENV_FILE" ]; then
    awk -F= -v k="$key" '$1==k{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" || true
  fi
}

make_secret(){
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
  fi
}

owner_token="$(read_key IZAKHONO_TASKS_TOKEN)"
flow_token="$(read_key IZAKHONO_TASKS_FLOW_TOKEN)"
[ -n "$owner_token" ] || owner_token="$(make_secret)"
[ -n "$flow_token" ] || flow_token="$(make_secret)"

tmp="$(mktemp)"
cat >"$tmp" <<EOF
IZAKHONO_TASKS_DB=/app/data/izakhono-tasks.db
IZAKHONO_TASKS_TOKEN=$owner_token
IZAKHONO_TASKS_FLOW_TOKEN=$flow_token
EOF

if [ -f "$ENV_FILE" ]; then
  for key in IZAKHONO_TASKS_RUNNER_URL IZAKHONO_TASKS_RUNNER_SECRET IZAKHONO_TASKS_POLL_SECONDS; do
    value="$(awk -F= -v k="$key" '$1==k{sub(/^[^=]*=/,"");print;exit}' "$ENV_FILE" || true)"
    [ -z "$value" ] || printf '%s=%s\n' "$key" "$value" >>"$tmp"
  done
fi

install -m 600 -o root -g root "$tmp" "$ENV_FILE"
rm -f "$tmp"

echo "IZAKHONO_TASKS_ENV=READY"
echo "ENV_FILE=$ENV_FILE"
echo "OWNER_CREDENTIALS=PRESENT_NOT_PRINTED"
