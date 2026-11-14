#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST_ROOT="$(cd "$ROOT/.." && pwd)"
LOCAL_PART="${1:-}"
DISPLAY_NAME="${2:-}"
[[ -n "$LOCAL_PART" ]] || { echo "Usage: $0 <local-part> [display-name]" >&2; exit 1; }
[[ "$LOCAL_PART" =~ ^[a-z0-9][a-z0-9._+-]{0,63}$ ]] || { echo "Invalid mailbox local-part." >&2; exit 2; }

cd "$HOST_ROOT"
[[ -f .env ]] || { echo "Host .env is missing." >&2; exit 3; }
set -a; . ./.env; set +a
: "${CONTROL_PLANE_TOKEN:?Missing CONTROL_PLANE_TOKEN}"
DOMAIN="${MAIL_DOMAIN:-izakhonoafrica.co.za}"
API="http://127.0.0.1:8082"
mkdir -p "$ROOT/handover"
chmod 700 "$ROOT/handover"

REQUEST="$(mktemp)"
trap 'rm -f "$REQUEST"' EXIT
python3 - "$DOMAIN" "$LOCAL_PART" "$DISPLAY_NAME" > "$REQUEST" <<'PY'
import json, sys
print(json.dumps({"domain": sys.argv[1], "local_part": sys.argv[2], "display_name": sys.argv[3]}))
PY

OUT="$ROOT/handover/$LOCAL_PART-$(date -u +%Y%m%dT%H%M%SZ).json"
curl -fsS -X POST "$API/api/mailboxes" \
  -H "Authorization: Bearer $CONTROL_PLANE_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "@$REQUEST" > "$OUT"
chmod 600 "$OUT"

echo "Mailbox created in pending-activation state."
echo "Address: $(jq -r '.address' "$OUT")"
echo "One-time handover token saved to: $OUT"
echo "Deliver the token out-of-band. Do not email it to the mailbox being created."
echo "Activate with: ./MAILBOX-ACTIVATE.sh $(jq -r '.address' "$OUT") $OUT"
