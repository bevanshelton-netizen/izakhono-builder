#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-}"
CONTROL_URL="${IZAKHONO_CONTROL_URL:-http://127.0.0.1:9292}"
TOKEN_FILE="${IZAKHONO_CONTROL_TOKEN_FILE:-/etc/izakhono/control.owner-token}"
OWNED_REPO=/var/lib/izakhono-code/repos/izakhono-builder.git

if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi
[ -n "$REPO_ROOT" ] || { echo "[STOP] Pass the checked-out izakhono-builder root."; exit 2; }
REPO_ROOT="$(readlink -f "$REPO_ROOT")"
[ -d "$REPO_ROOT/.git" ] || { echo "[STOP] Not a Git checkout: $REPO_ROOT"; exit 3; }

for cmd in git curl python3 docker; do command -v "$cmd" >/dev/null 2>&1 || { echo "[STOP] Missing $cmd."; exit 4; }; done
curl -fsS "$CONTROL_URL/healthz" >/dev/null || { echo "[STOP] IZAKHONO CONTROL is not healthy."; exit 5; }
curl -fsS "http://127.0.0.1:9191/readyz" >/dev/null || { echo "[STOP] IZAKHONO NODE is not ready."; exit 6; }
[ -f "$TOKEN_FILE" ] || { echo "[STOP] CONTROL owner token is missing."; exit 7; }
TOKEN="$(tr -d '\r\n' <"$TOKEN_FILE")"; [ -n "$TOKEN" ] || { echo "[STOP] CONTROL token empty."; exit 8; }

bash "$REPO_ROOT/products/izakhono-crm/owner-node/prepare-env.sh"
bash "$REPO_ROOT/products/izakhono-sign/owner-node/prepare-env.sh"
bash "$REPO_ROOT/products/izakhono-flowiq/owner-node/prepare-env.sh"
bash "$REPO_ROOT/products/izakhono-docflow/owner-node/prepare-env.sh"
bash "$REPO_ROOT/products/izakhono-node/sync-builder-to-code.sh" "$REPO_ROOT"

SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "[STOP] Could not resolve immutable source commit."; exit 9; }
git --git-dir="$OWNED_REPO" cat-file -e "$SHA^{commit}" || { echo "[STOP] Commit $SHA is not present in IZAKHONO CODE."; exit 10; }

deploy_app(){
  local app="$1" port="$2" health="$3" data="$4" dockerfile="$5" envfile="$6"
  local job response id status detail
  job="$(python3 - "$SHA" "$app" "$port" "$health" "$data" "$dockerfile" "$envfile" <<'PY'
import json,sys
sha,app,port,health,data,dockerfile,envfile=sys.argv[1:]
print(json.dumps({
 "source":"izakhono-code","repository":"izakhono-builder","app":app,"ref":sha,
 "environment":"production","mode":"single","container_port":int(port),"health_path":health,
 "data_path":data,"dockerfile":dockerfile,"env_file":envfile
},separators=(",",":")))
PY
)"
  response="$(curl -fsS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary "$job" "$CONTROL_URL/v1/deploy")"
  id="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' <<<"$response")"
  [ -n "$id" ] || { echo "[FAIL] No deployment job id for $app"; exit 20; }
  echo "DEPLOY_JOB $app $id"
  status=""
  for _ in $(seq 1 300); do
    detail="$(curl -fsS -H "Authorization: Bearer $TOKEN" "$CONTROL_URL/v1/jobs/$id")"
    status="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"$detail")"
    case "$status" in succeeded|failed|timed_out|interrupted) break;; esac
    sleep 3
  done
  [ "$status" = "succeeded" ] || { echo "[FAIL] $app deployment status=$status"; echo "$detail"; exit 21; }
}

# Bind SIGN to DOCFLOW without exposing either secret.
DOCFLOW_SERVICE_SECRET="$(awk -F= '$1=="DOCFLOW_SERVICE_TOKEN"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/apps/izakhono-docflow.env)"
[ -n "$DOCFLOW_SERVICE_SECRET" ] || { echo "[FAIL] DOCFLOW service token missing."; exit 11; }
python3 - "$DOCFLOW_SERVICE_SECRET" <<'PY'
from pathlib import Path
import os,sys
path=Path("/etc/izakhono/apps/izakhono-sign.env")
updates={"DOCFLOW_URL":"http://izakhono-docflow:8787","DOCFLOW_SERVICE_TOKEN":sys.argv[1]}
lines=path.read_text().splitlines() if path.exists() else []
out=[]; seen=set()
for line in lines:
    key=line.split("=",1)[0] if "=" in line else ""
    if key in updates:
        out.append(f"{key}={updates[key]}"); seen.add(key)
    else: out.append(line)
for k,v in updates.items():
    if k not in seen: out.append(f"{k}={v}")
tmp=path.with_suffix(".tmp"); tmp.write_text("\n".join(out)+"\n"); os.chmod(tmp,0o600); tmp.replace(path); os.chmod(path,0o600)
PY
unset DOCFLOW_SERVICE_SECRET

deploy_app izakhono-crm 8080 /health /data products/izakhono-crm/Dockerfile.node /etc/izakhono/apps/izakhono-crm.env
deploy_app izakhono-sign 9898 /readyz /app/data products/izakhono-sign/Dockerfile.node /etc/izakhono/apps/izakhono-sign.env

CRM_INGEST_SECRET="$(awk -F= '$1=="CRM_INGEST_TOKEN"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/apps/izakhono-crm.env)"
SIGN_API_SECRET="$(awk -F= '$1=="SIGN_API_TOKEN"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/apps/izakhono-sign.env)"
[ -n "$CRM_INGEST_SECRET" ] && [ -n "$SIGN_API_SECRET" ] || { echo "[FAIL] CRM/SIGN binding credentials missing."; exit 12; }

python3 - "$CRM_INGEST_SECRET" "$SIGN_API_SECRET" <<'PY'
from pathlib import Path
import os,sys
path=Path("/etc/izakhono/apps/izakhono-flowiq.env")
updates={
 "FLOWIQ_CRM_URL":"http://izakhono-crm:8080",
 "FLOWIQ_CRM_TOKEN":sys.argv[1],
 "FLOWIQ_DELIVERY_URL":"http://izakhono-sign:9898",
 "FLOWIQ_DELIVERY_TOKEN":sys.argv[2],
}
lines=path.read_text().splitlines() if path.exists() else []
out=[]; seen=set()
for line in lines:
    key=line.split("=",1)[0] if "=" in line else ""
    if key in updates:
        out.append(f"{key}={updates[key]}"); seen.add(key)
    else: out.append(line)
for k,v in updates.items():
    if k not in seen: out.append(f"{k}={v}")
tmp=path.with_suffix(".tmp"); tmp.write_text("\n".join(out)+"\n"); os.chmod(tmp,0o600); tmp.replace(path); os.chmod(path,0o600)
PY
unset CRM_INGEST_SECRET SIGN_API_SECRET

# Existing FLOWIQ deployment path also rebinds and redeploys DOCFLOW.
FLOWIQ_BIND_DOCFLOW=true bash "$REPO_ROOT/products/izakhono-flowiq/owner-node/deploy-node01.sh" "$REPO_ROOT"

FLOW_READY="$(curl -fsS http://127.0.0.1:9797/readyz)"
SIGN_READY="$(curl -fsS http://127.0.0.1:9898/readyz)"
DOC_READY="$(curl -fsS http://127.0.0.1:8787/api/ready)"
CRM_HEALTH="$(curl -fsS http://127.0.0.1:8080/health)"

python3 - "$SHA" "$FLOW_READY" "$SIGN_READY" "$DOC_READY" "$CRM_HEALTH" <<'PY'
import json,sys,time,pathlib
sha,flow_raw,sign_raw,doc_raw,crm_raw=sys.argv[1:]
flow,sign,doc,crm=map(json.loads,[flow_raw,sign_raw,doc_raw,crm_raw])
assert flow.get("ok") is True
assert flow.get("adapters",{}).get("crm") is True
assert flow.get("adapters",{}).get("delivery") is True
assert sign.get("ok") is True and sign.get("docflow_configured") is True
assert doc.get("ok") is True and doc.get("service_token_configured") is True
assert crm.get("ok") is True
report={
 "schema":"izakhono.docflow.workflow_chain.v1",
 "generated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
 "commit":sha,
 "crm_ready":True,
 "sign_ready":True,
 "flowiq_crm_bound":True,
 "flowiq_delivery_bound":True,
 "docflow_service_token_ready":True,
 "sign_public_route_configured":bool(sign.get("public_route_configured")),
 "sign_mail_adapter_configured":bool(sign.get("mail_adapter_configured")),
 "public_live":False
}
path=pathlib.Path("/var/lib/izakhono-node/evidence/izakhono-docflow-crm-sign-chain.json")
path.write_text(json.dumps(report,indent=2)); print(json.dumps(report,indent=2))
PY

docker exec izakhono-flowiq node -e "Promise.all([fetch('http://izakhono-crm:8080/health'),fetch('http://izakhono-sign:9898/healthz')]).then(rs=>{if(rs.some(r=>!r.ok))process.exit(2);console.log('[PASS] FLOWIQ reaches CRM and SIGN privately.')}).catch(e=>{console.error(e);process.exit(3)})"
docker exec izakhono-sign node -e "fetch('http://izakhono-docflow:8787/api/health').then(r=>{if(!r.ok)process.exit(2);console.log('[PASS] SIGN reaches DOCFLOW privately.')}).catch(e=>{console.error(e);process.exit(3)})"

echo "[PASS] DOCFLOW -> FLOWIQ -> CRM/SIGN private workflow chain verified on NODE01."
echo "[BOUNDARY] SIGN public route and outbound mail remain separate activation gates."
