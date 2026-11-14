#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

EMAIL="${1:-}"
HANDOVER_FILE="${2:-}"
[[ -n "$EMAIL" && -f "$HANDOVER_FILE" ]] || { echo "Usage: $0 <email-address> <handover-json-file>" >&2; exit 1; }
command -v jq >/dev/null
command -v python3 >/dev/null
API="http://127.0.0.1:8082"

HANDOVER_TOKEN="$(jq -r '.handover_token // empty' "$HANDOVER_FILE")"
[[ -n "$HANDOVER_TOKEN" ]] || { echo "Handover token not found in file." >&2; exit 2; }

TMP_ROOT="$(mktemp -d)"
chmod 700 "$TMP_ROOT"
trap 'rm -rf "$TMP_ROOT"' EXIT
HANDOVER_REQUEST="$TMP_ROOT/handover.json"
ACTIVATE_REQUEST="$TMP_ROOT/activate.json"
HANDOVER_RESPONSE="$TMP_ROOT/activation-token.json"
chmod 600 "$HANDOVER_REQUEST" "$ACTIVATE_REQUEST" "$HANDOVER_RESPONSE" 2>/dev/null || true

python3 - "$HANDOVER_TOKEN" > "$HANDOVER_REQUEST" <<'PY'
import json, sys
print(json.dumps({"handover_token": sys.argv[1]}))
PY
curl -fsS -X POST "$API/api/mailboxes/handover" \
  -H "Content-Type: application/json" \
  --data-binary "@$HANDOVER_REQUEST" > "$HANDOVER_RESPONSE"
ACTIVATION_TOKEN="$(jq -r '.activation_token // empty' "$HANDOVER_RESPONSE")"
[[ -n "$ACTIVATION_TOKEN" ]] || { echo "Handover redemption did not return an activation token." >&2; exit 3; }

read -r -s -p "Choose a new password (minimum 12 characters): " NEW_PASSWORD
echo
read -r -s -p "Confirm new password: " CONFIRM_PASSWORD
echo
[[ "$NEW_PASSWORD" == "$CONFIRM_PASSWORD" ]] || { echo "Passwords do not match." >&2; exit 4; }
[[ "${#NEW_PASSWORD}" -ge 12 ]] || { echo "Password must be at least 12 characters." >&2; exit 5; }

ACTIVATION_TOKEN="$ACTIVATION_TOKEN" NEW_PASSWORD="$NEW_PASSWORD" python3 - > "$ACTIVATE_REQUEST" <<'PY'
import json, os
print(json.dumps({
    "activation_token": os.environ["ACTIVATION_TOKEN"],
    "new_password": os.environ["NEW_PASSWORD"],
}))
PY
unset NEW_PASSWORD CONFIRM_PASSWORD ACTIVATION_TOKEN HANDOVER_TOKEN

curl -fsS -X POST "$API/api/account/activate" \
  -H "Content-Type: application/json" \
  --data-binary "@$ACTIVATE_REQUEST"
echo
rm -f "$HANDOVER_FILE"
echo "Mailbox activated. Sign in through https://webmail.izakhonoafrica.co.za"
