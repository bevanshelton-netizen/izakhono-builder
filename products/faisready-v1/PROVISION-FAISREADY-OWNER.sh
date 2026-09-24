#!/usr/bin/env bash
set -euo pipefail
[ "${EUID:-$(id -u)}" -eq 0 ] || { echo '[STOP] Run as root on NODE01.'; exit 1; }

STACK_ENV=/opt/izakhono/launch-stack/.env
FABRIC_ENV=/opt/izakhono/secrets/app-fabric-runtime.env
OUT=/opt/izakhono/secrets/faisready.env
[ -f "$STACK_ENV" ] || { echo '[STOP] IZAKHONO Launch Stack is not installed.'; exit 1; }
set -a
source "$STACK_ENV"
[ -f "$FABRIC_ENV" ] && source "$FABRIC_ENV"
set +a
: "${IZAKHONO_CORE_ADMIN_TOKEN:?Missing IZAKHONO Core admin token}"

read -r -p 'Owner email: ' OWNER_EMAIL
read -r -s -p 'Owner password (10+ characters): ' OWNER_PASSWORD
echo
[ ${#OWNER_PASSWORD} -ge 10 ] || { echo '[STOP] Password is too short.'; exit 1; }

ADMIN=http://127.0.0.1:8787/v1/admin/projects
AUTH=http://127.0.0.1:8787/v1/auth/faisready
CREATE=$(curl -fsS "$ADMIN" -H "Authorization: Bearer $IZAKHONO_CORE_ADMIN_TOKEN" -H 'Content-Type: application/json' -d '{"project":"faisready","allow_signup":true}')
PROJECT_KEY=$(printf '%s' "$CREATE" | jq -r '.public_key')
[ -n "$PROJECT_KEY" ] && [ "$PROJECT_KEY" != null ] || { echo '[STOP] Could not provision FAISReady Core project.'; exit 1; }

curl -fsS "$AUTH/signup" -H "X-Project-Key: $PROJECT_KEY" -H 'Content-Type: application/json'   -d "$(jq -n --arg email "$OWNER_EMAIL" --arg password "$OWNER_PASSWORD" '{email:$email,password:$password,user_metadata:{role:"owner",platform:"faisready"}}')" >/dev/null

curl -fsS "$ADMIN" -H "Authorization: Bearer $IZAKHONO_CORE_ADMIN_TOKEN" -H 'Content-Type: application/json'   -d "$(jq -n --arg key "$PROJECT_KEY" '{project:"faisready",rotate:true,allow_signup:false,public_key:$key}')" >/dev/null

umask 077
cat > "$OUT" <<EOF
FAISREADY_CORE_ENDPOINT=http://izakhono-core:8787
FAISREADY_CORE_PROJECT=faisready
FAISREADY_CORE_PROJECT_KEY=$PROJECT_KEY
FAISREADY_CRM_ENDPOINT=http://izakhono-crm:8080
FAISREADY_CRM_ADMIN_TOKEN=${CRM_ADMIN_TOKEN:-}
FAISREADY_CRM_INGEST_TOKEN=${CRM_INGEST_TOKEN:-}
FAISREADY_ENTITY_ID=izakhono-africa
FAISREADY_COMMERCIAL_READY=false
EOF
chmod 600 "$OUT"
unset OWNER_PASSWORD
echo '[PASS] FAISReady owner account and fail-closed runtime configuration created.'
echo "Secrets: $OUT"
echo '[HOLD] FAISREADY_COMMERCIAL_READY remains false until public HTTPS, policies, merch fulfilment and payment acceptance are checked.'
