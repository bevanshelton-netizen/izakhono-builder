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

docker inspect izakhono-core >/dev/null 2>&1 || { echo '[STOP] IZAKHONO Core container is not running.'; exit 1; }
command -v jq >/dev/null 2>&1 || { echo '[STOP] jq is required on NODE01.'; exit 1; }

read -r -p 'Owner email: ' OWNER_EMAIL
read -r -s -p 'Owner password (10+ characters): ' OWNER_PASSWORD
echo
[ ${#OWNER_PASSWORD} -ge 10 ] || { echo '[STOP] Password is too short.'; exit 1; }

core_post() {
  local path="$1" auth="$2" project_key="$3" body="$4"
  docker exec \
    -e "FAIS_PATH=$path" \
    -e "FAIS_AUTH=$auth" \
    -e "FAIS_PROJECT_KEY=$project_key" \
    -e "FAIS_BODY=$body" \
    izakhono-core node -e '
      const h={"content-type":"application/json"};
      if(process.env.FAIS_AUTH) h.authorization="Bearer "+process.env.FAIS_AUTH;
      if(process.env.FAIS_PROJECT_KEY) h["x-project-key"]=process.env.FAIS_PROJECT_KEY;
      fetch("http://127.0.0.1:8787"+process.env.FAIS_PATH,{method:"POST",headers:h,body:process.env.FAIS_BODY})
        .then(async r=>{const t=await r.text(); if(!r.ok){console.error(t); process.exit(1)} process.stdout.write(t)})
        .catch(e=>{console.error(e);process.exit(1)})'
}

PROJECT_KEY=""
if [ -f "$OUT" ]; then
  PROJECT_KEY=$(awk -F= '$1=="FAISREADY_CORE_PROJECT_KEY"{print substr($0,index($0,"=")+1)}' "$OUT" | tail -n1)
fi

if [ -n "$PROJECT_KEY" ]; then
  OPEN_BODY=$(jq -nc --arg key "$PROJECT_KEY" '{project:"faisready",rotate:true,allow_signup:true,public_key:$key}')
  core_post "/v1/admin/projects" "$IZAKHONO_CORE_ADMIN_TOKEN" "" "$OPEN_BODY" >/dev/null
else
  CREATE=$(core_post "/v1/admin/projects" "$IZAKHONO_CORE_ADMIN_TOKEN" "" '{"project":"faisready","rotate":true,"allow_signup":true}')
  PROJECT_KEY=$(printf '%s' "$CREATE" | jq -r '.public_key')
fi
[ -n "$PROJECT_KEY" ] && [ "$PROJECT_KEY" != null ] || { echo '[STOP] Could not provision FAISReady Core project.'; exit 1; }

SIGNUP_BODY=$(jq -nc --arg email "$OWNER_EMAIL" --arg password "$OWNER_PASSWORD" '{email:$email,password:$password,user_metadata:{role:"owner",platform:"faisready"}}')
set +e
SIGNUP_RESULT=$(core_post "/v1/auth/faisready/signup" "" "$PROJECT_KEY" "$SIGNUP_BODY" 2>&1)
SIGNUP_RC=$?
set -e
if [ "$SIGNUP_RC" -ne 0 ] && ! printf '%s' "$SIGNUP_RESULT" | grep -qi 'Account already exists'; then
  printf '%s\n' "$SIGNUP_RESULT" >&2
  exit "$SIGNUP_RC"
fi

LOCK_BODY=$(jq -nc --arg key "$PROJECT_KEY" '{project:"faisready",rotate:true,allow_signup:false,public_key:$key}')
core_post "/v1/admin/projects" "$IZAKHONO_CORE_ADMIN_TOKEN" "" "$LOCK_BODY" >/dev/null

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

echo '[PASS] FAISReady owner account and fail-closed runtime configuration are ready.'
echo "Secrets: $OUT"
echo '[HOLD] FAISREADY_COMMERCIAL_READY remains false until public HTTPS, policies, merch fulfilment and payment acceptance are checked.'
