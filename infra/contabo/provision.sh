#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-plus8}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

: "${CONTABO_CLIENT_ID:?Set CONTABO_CLIENT_ID}"
: "${CONTABO_CLIENT_SECRET:?Set CONTABO_CLIENT_SECRET}"
: "${CONTABO_API_USER:?Set CONTABO_API_USER}"
: "${CONTABO_API_PASSWORD:?Set CONTABO_API_PASSWORD}"
: "${CONTABO_IMAGE_ID:?Set CONTABO_IMAGE_ID to a verified Ubuntu 24.04 image ID}"
: "${CONTABO_SSH_KEY_IDS:?Set CONTABO_SSH_KEY_IDS to comma-separated Contabo SSH secret IDs}"
: "${CONTABO_REGION:=EU}"
: "${CONTABO_PERIOD:=1}"
: "${IZAKHONO_NODE_ID:=CONTABO-VPS-01}"

case "$PROFILE" in
  plus4) PRODUCT_ID="V159"; EXPECTED="4 vCPU / 8 GB / 150 GB NVMe / 500 Mbit/s" ;;
  plus6) PRODUCT_ID="V160"; EXPECTED="6 vCPU / 12 GB / 300 GB NVMe / 500 Mbit/s" ;;
  plus8) PRODUCT_ID="V161"; EXPECTED="8 vCPU / 24 GB / 450 GB NVMe / 1 Gbit/s" ;;
  *) echo "Unknown profile: $PROFILE (use plus4, plus6 or plus8)" >&2; exit 2 ;;
esac

API="https://api.contabo.com"
REQUEST_ID="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)"

echo "== IZAKHONO Contabo Provisioner =="
echo "Profile : $PROFILE"
echo "Product : $PRODUCT_ID"
echo "Target  : $EXPECTED"
echo "Node ID : $IZAKHONO_NODE_ID"

echo "Authenticating with Contabo API..."
TOKEN_RESPONSE="$(curl -fsS -X POST \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "client_id=${CONTABO_CLIENT_ID}" \
  --data-urlencode "client_secret=${CONTABO_CLIENT_SECRET}" \
  --data-urlencode "username=${CONTABO_API_USER}" \
  --data-urlencode "password=${CONTABO_API_PASSWORD}" \
  --data-urlencode 'grant_type=password' \
  'https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token')"

ACCESS_TOKEN="$(jq -er '.access_token' <<<"$TOKEN_RESPONSE")"

headers=(
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
  -H "x-request-id: ${REQUEST_ID}"
  -H 'Content-Type: application/json'
)

# Reuse an existing IZAKHONO node with the same display name instead of creating duplicates.
existing="$(curl -fsS "${API}/v1/compute/instances?displayName=${IZAKHONO_NODE_ID}" "${headers[@]}")"
existing_count="$(jq -r '._pagination.totalElements // 0' <<<"$existing")"

if [[ "$existing_count" != "0" ]]; then
  echo "Existing node found; no duplicate instance will be created."
  jq '.data[] | {instanceId,name,displayName,productId,region,status}' <<<"$existing"
  exit 0
fi

ssh_keys_json="$(tr ',' '\n' <<<"$CONTABO_SSH_KEY_IDS" | jq -R . | jq -s 'map(tonumber)')"
user_data="$(cat "${ROOT_DIR}/cloud-init.yaml")"
payload="$(jq -n \
  --arg imageId "$CONTABO_IMAGE_ID" \
  --arg productId "$PRODUCT_ID" \
  --arg region "$CONTABO_REGION" \
  --arg displayName "$IZAKHONO_NODE_ID" \
  --arg userData "$user_data" \
  --argjson sshKeys "$ssh_keys_json" \
  --argjson period "$CONTABO_PERIOD" \
  '{imageId:$imageId,productId:$productId,region:$region,sshKeys:$sshKeys,userData:$userData,period:$period,displayName:$displayName,defaultUser:"admin"}')"

echo "Creating Contabo instance..."
response="$(curl -fsS -X POST "${API}/v1/compute/instances" "${headers[@]}" --data "$payload")"

jq '.data[] | {instanceId,name,displayName,productId,region,status}' <<<"$response"

echo
printf '%s\n' "Provisioning request accepted. Public service status is NOT implied."
echo "Next gate: inspect the instance, verify SSH + /health, then configure approved EDGE/TLS/DNS."
