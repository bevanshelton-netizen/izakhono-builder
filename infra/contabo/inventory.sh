#!/usr/bin/env bash
set -euo pipefail
set +x

: "${CONTABO_CLIENT_ID:?Set CONTABO_CLIENT_ID in your local secret store}"
: "${CONTABO_CLIENT_SECRET:?Set CONTABO_CLIENT_SECRET in your local secret store}"
: "${CONTABO_API_USER:?Set CONTABO_API_USER in your local secret store}"
: "${CONTABO_API_PASSWORD:?Set CONTABO_API_PASSWORD in your local secret store}"

API="https://api.contabo.com"
REQUEST_ID="$(cat /proc/sys/kernel/random/uuid 2>/dev/null || uuidgen)"

# Read-only inventory: this script performs authentication and GET requests only.
TOKEN_RESPONSE="$(curl -fsS --retry 2 -X POST \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode "client_id=${CONTABO_CLIENT_ID}" \
  --data-urlencode "client_secret=${CONTABO_CLIENT_SECRET}" \
  --data-urlencode "username=${CONTABO_API_USER}" \
  --data-urlencode "password=${CONTABO_API_PASSWORD}" \
  --data-urlencode 'grant_type=password' \
  'https://auth.contabo.com/auth/realms/contabo/protocol/openid-connect/token')"
ACCESS_TOKEN="$(jq -er '.access_token' <<<"$TOKEN_RESPONSE")"
trap 'unset ACCESS_TOKEN TOKEN_RESPONSE' EXIT

headers=(
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
  -H "x-request-id: ${REQUEST_ID}"
  -H 'Accept: application/json'
)

printf 'instanceId\tname\tdisplayName\tproductId\tregion\tstatus\tipv4\tosType\tcpuCores\tramMb\tdiskMb\n'
page=1
while :; do
  response="$(curl -fsS --retry 2 \
    --get \
    --data-urlencode "page=${page}" \
    --data-urlencode 'size=50' \
    "${API}/v1/compute/instances" "${headers[@]}")"

  jq -r '
    (.data // [])[] |
    [
      (.instanceId // ""),
      (.name // ""),
      (.displayName // ""),
      (.productId // ""),
      (.region // ""),
      (.status // ""),
      (.ipConfig.v4.ip // ""),
      (.osType // ""),
      (.cpuCores // ""),
      (.ramMb // ""),
      (.diskMb // "")
    ] | @tsv
  ' <<<"$response"

  total_pages="$(jq -r '._pagination.totalPages // 1' <<<"$response")"
  [[ "$page" -lt "$total_pages" ]] || break
  page=$((page + 1))
done
