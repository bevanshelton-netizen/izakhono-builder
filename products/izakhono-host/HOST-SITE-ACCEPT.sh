#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
DOMAIN="${1:-}"
[[ "$DOMAIN" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] || { echo "Usage: $0 <domain>" >&2; exit 1; }
[[ -f .env ]] || { echo "Host .env is missing." >&2; exit 2; }
set -a; . ./.env; set +a
: "${HOST_RUNTIME_TOKEN:?Missing HOST_RUNTIME_TOKEN}"
API="http://127.0.0.1:8080"
TMP="$(mktemp -d)"; chmod 700 "$TMP"; trap 'rm -rf "$TMP"' EXIT
curl -fsS "$API/api/sites" -H "Authorization: Bearer $HOST_RUNTIME_TOKEN" > "$TMP/sites.json"
SITE_ID="$(jq -r --arg domain "$DOMAIN" '.sites[] | select(.domain == $domain) | .id' "$TMP/sites.json" | head -n1)"
[[ -n "$SITE_ID" ]] || { echo "Site is not provisioned: $DOMAIN" >&2; exit 3; }
curl -fsS -X POST "$API/api/sites/$SITE_ID/accept" \
  -H "Authorization: Bearer $HOST_RUNTIME_TOKEN" > "$TMP/result.json"
jq '{live,site:{domain:.site.domain,status:.site.status,acceptance:.site.acceptance},evidence}' "$TMP/result.json"
if [[ "$(jq -r '.live' "$TMP/result.json")" != "true" ]]; then
  echo "Acceptance remains pending. Configure HOST_PUBLIC_IP, public DNS, HTTPS and external routing; then retry."
  exit 4
fi
echo "Server-side acceptance checks passed. Review independent external evidence before commercial launch."
