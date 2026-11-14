#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST_ROOT="$(cd "$ROOT/.." && pwd)"
cd "$HOST_ROOT"
[[ -f .env ]] || { echo "Host .env is missing." >&2; exit 1; }
set -a; . ./.env; set +a
: "${CONTROL_PLANE_TOKEN:?Missing CONTROL_PLANE_TOKEN}"
API="http://127.0.0.1:8082"
ACTION="${1:-status}"
DOMAIN="${MAIL_DOMAIN:-izakhonoafrica.co.za}"

case "$ACTION" in
  status)
    curl -fsS "$API/api/ready"
    echo
    curl -fsS -H "Authorization: Bearer $CONTROL_PLANE_TOKEN" "$API/api/domains"
    echo
    ;;
  request)
    mkdir -p "$ROOT/handover"
    chmod 700 "$ROOT/handover"
    OUT="$ROOT/handover/domain-verification-$(date -u +%Y%m%dT%H%M%SZ).json"
    BODY="$(mktemp)"
    trap 'rm -f "$BODY"' EXIT
    printf '{"domain":"%s"}\n' "$DOMAIN" > "$BODY"
    curl -fsS -X POST "$API/api/domains/verification" \
      -H "Authorization: Bearer $CONTROL_PLANE_TOKEN" \
      -H "Content-Type: application/json" \
      --data-binary "@$BODY" > "$OUT"
    chmod 600 "$OUT"
    echo "Publish this exact TXT challenge:"
    jq -r '"Name:  " + .record_name + "\nValue: " + .record_value' "$OUT"
    echo "Challenge file saved securely at: $OUT"
    ;;
  verify)
    BODY="$(mktemp)"
    trap 'rm -f "$BODY"' EXIT
    printf '{"domain":"%s"}\n' "$DOMAIN" > "$BODY"
    curl -fsS -X POST "$API/api/domains/verify" \
      -H "Authorization: Bearer $CONTROL_PLANE_TOKEN" \
      -H "Content-Type: application/json" \
      --data-binary "@$BODY"
    echo
    ;;
  *)
    echo "Usage: $0 [status|request|verify]" >&2
    exit 2
    ;;
esac
