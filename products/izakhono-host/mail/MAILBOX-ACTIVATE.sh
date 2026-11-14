#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

EMAIL="${1:-}"
HANDOVER_FILE="${2:-}"
[[ -n "$EMAIL" && -f "$HANDOVER_FILE" ]] || { echo "Usage: $0 <email-address> <handover-json-file>" >&2; exit 1; }
command -v jq >/dev/null
command -v python3 >/dev/null
API="http://127.0.0.1:8082"

HANDOVER_EMAIL="$(jq -r '.address // empty' "$HANDOVER_FILE")"
[[ "$HANDOVER_EMAIL" == "$EMAIL" ]] || { echo "Email address does not match the handover file." >&2; exit 2; }

TMP_ROOT="$(mktemp -d)"
chmod 700 "$TMP_ROOT"
trap 'rm -rf "$TMP_ROOT"' EXIT
HANDOVER_REQUEST="$TMP_ROOT/handover.json"
ACTIVATE_REQUEST="$TMP_ROOT/activate.json"
HANDOVER_RESPONSE="$TMP_ROOT/activation-token.json"
chmod 600 "$HANDOVER_REQUEST" "$ACTIVATE_REQUEST" "$HANDOVER_RESPONSE" 2>/dev/null || true

jq -n --argfile handover "$HANDOVER_FILE" '{handover_token: $handover.handover_token}' > "$HANDOVER_REQUEST"
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

PASSWORD_FILE="$TMP_ROOT/new-password"
printf '%s' "$NEW_PASSWORD" > "$PASSWORD_FILE"
chmod 600 "$PASSWORD_FILE"
jq -n --argfile activation "$HANDOVER_RESPONSE" --rawfile password "$PASSWORD_FILE" '{activation_token: $activation.activation_token, new_password: $password}' > "$ACTIVATE_REQUEST"
unset NEW_PASSWORD CONFIRM_PASSWORD ACTIVATION_TOKEN

curl -fsS -X POST "$API/api/account/activate" \
  -H "Content-Type: application/json" \
  --data-binary "@$ACTIVATE_REQUEST"
echo
rm -f "$HANDOVER_FILE"
echo "Mailbox activated. Sign in through https://webmail.izakhonoafrica.co.za"
