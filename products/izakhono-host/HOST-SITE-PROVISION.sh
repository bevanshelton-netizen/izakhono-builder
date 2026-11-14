#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
DOMAIN="${1:-}"
SOURCE_REF="${2:-operator}"
[[ "$DOMAIN" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] || { echo "Usage: $0 <domain> [source-ref]" >&2; exit 1; }
[[ -f .env ]] || { echo "Host .env is missing." >&2; exit 2; }
set -a; . ./.env; set +a
: "${HOST_RUNTIME_TOKEN:?Missing HOST_RUNTIME_TOKEN}"
API="http://127.0.0.1:8080"
TMP="$(mktemp -d)"; chmod 700 "$TMP"; trap 'rm -rf "$TMP"' EXIT
python3 - "$DOMAIN" "$SOURCE_REF" > "$TMP/request.json" <<'PY'
import json, sys
print(json.dumps({"domain": sys.argv[1], "source_ref": sys.argv[2]}))
PY
curl -fsS -X POST "$API/api/sites/provision" \
  -H "Authorization: Bearer $HOST_RUNTIME_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "@$TMP/request.json" > "$TMP/response.json"
jq '{ok,created,site}' "$TMP/response.json"
echo "Site provisioned on the owned runtime. DNS, HTTPS and public acceptance are still pending."
