#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-}"
CONTROL_URL="${IZAKHONO_CONTROL_URL:-http://127.0.0.1:9292}"
TOKEN_FILE="${IZAKHONO_CONTROL_TOKEN_FILE:-/etc/izakhono/control.owner-token}"
OWNED_REPO=/var/lib/izakhono-code/repos/izakhono-builder.git

if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi
[ -n "$REPO_ROOT" ] || { echo "[STOP] Pass the checked-out izakhono-builder root."; exit 2; }
REPO_ROOT="$(readlink -f "$REPO_ROOT")"
[ -d "$REPO_ROOT/.git" ] || { echo "[STOP] Not a Git checkout."; exit 3; }

for cmd in git curl python3 docker; do command -v "$cmd" >/dev/null 2>&1 || { echo "[STOP] Missing $cmd."; exit 4; }; done
curl -fsS "$CONTROL_URL/healthz" >/dev/null || { echo "[STOP] CONTROL unhealthy."; exit 5; }
curl -fsS http://127.0.0.1:9191/readyz >/dev/null || { echo "[STOP] NODE not ready."; exit 6; }
[ -f "$TOKEN_FILE" ] || { echo "[STOP] CONTROL token missing."; exit 7; }
TOKEN="$(tr -d '\r\n' <"$TOKEN_FILE")"; [ -n "$TOKEN" ] || exit 8

# Ensure the core chain exists first.
bash "$REPO_ROOT/products/izakhono-sign/owner-node/deploy-docflow-chain.sh" "$REPO_ROOT"
bash "$REPO_ROOT/products/izakhono-mail/owner-node/prepare-env.sh"
bash "$REPO_ROOT/products/izakhono-node/sync-builder-to-code.sh" "$REPO_ROOT"

SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
git --git-dir="$OWNED_REPO" cat-file -e "$SHA^{commit}" || { echo "[STOP] Commit not present in IZAKHONO CODE."; exit 9; }

submit(){
  local app="$1" port="$2" health="$3" data="$4" dockerfile="$5" envfile="$6"
  local payload response id status detail
  payload="$(python3 - "$SHA" "$app" "$port" "$health" "$data" "$dockerfile" "$envfile" <<'PY'
import json,sys
sha,app,port,health,data,dockerfile,envfile=sys.argv[1:]
print(json.dumps({"source":"izakhono-code","repository":"izakhono-builder","app":app,"ref":sha,"environment":"production","mode":"single","container_port":int(port),"health_path":health,"data_path":data,"dockerfile":dockerfile,"env_file":envfile},separators=(",",":")))
PY
)"
  response="$(curl -fsS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary "$payload" "$CONTROL_URL/v1/deploy")"
  id="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' <<<"$response")"
  [ -n "$id" ] || { echo "[FAIL] no job id for $app"; exit 20; }
  status=""
  for _ in $(seq 1 300); do
    detail="$(curl -fsS -H "Authorization: Bearer $TOKEN" "$CONTROL_URL/v1/jobs/$id")"
    status="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"$detail")"
    case "$status" in succeeded|failed|timed_out|interrupted) break;; esac
    sleep 3
  done
  [ "$status" = "succeeded" ] || { echo "[FAIL] $app status=$status"; echo "$detail"; exit 21; }
}

submit izakhono-mail 9899 /readyz /app/data products/izakhono-mail/Dockerfile.node /etc/izakhono/apps/izakhono-mail.env

MAIL_SECRET="$(awk -F= '$1=="MAIL_API_TOKEN"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/apps/izakhono-mail.env)"
[ -n "$MAIL_SECRET" ] || { echo "[FAIL] MAIL API token missing."; exit 10; }
python3 - "$MAIL_SECRET" <<'PY'
from pathlib import Path
import os,sys
path=Path("/etc/izakhono/apps/izakhono-sign.env")
updates={"SIGN_MAIL_URL":"http://izakhono-mail:9899","SIGN_MAIL_TOKEN":sys.argv[1]}
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
unset MAIL_SECRET

submit izakhono-sign 9898 /readyz /app/data products/izakhono-sign/Dockerfile.node /etc/izakhono/apps/izakhono-sign.env

MAIL_READY="$(curl -fsS http://127.0.0.1:9899/readyz)"
SIGN_READY="$(curl -fsS http://127.0.0.1:9898/readyz)"
python3 - "$SHA" "$MAIL_READY" "$SIGN_READY" <<'PY'
import json,sys,time,pathlib
sha,mail_raw,sign_raw=sys.argv[1:]
mail,sign=map(json.loads,[mail_raw,sign_raw])
assert mail.get("ok") is True
assert sign.get("ok") is True
assert sign.get("mail_adapter_configured") is True
report={
 "schema":"izakhono.mail.sign.binding.v1",
 "generated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
 "commit":sha,
 "mail_ready":True,
 "smtp_configured":bool(mail.get("smtp_configured")),
 "sign_mail_bound":True,
 "sign_public_route_configured":bool(sign.get("public_route_configured")),
 "public_live":False
}
path=pathlib.Path("/var/lib/izakhono-node/evidence/izakhono-mail-sign-binding.json")
path.write_text(json.dumps(report,indent=2)); print(json.dumps(report,indent=2))
PY

docker exec izakhono-sign node -e "fetch('http://izakhono-mail:9899/healthz').then(r=>{if(!r.ok)process.exit(2);console.log('[PASS] SIGN reaches IZAKHONO MAIL privately.')}).catch(e=>{console.error(e);process.exit(3)})"

echo "[PASS] IZAKHONO MAIL is bound to SIGN."
echo "[BOUNDARY] If SMTP is not configured, messages remain durably queued as awaiting_smtp."
echo "[BOUNDARY] Public SIGN hostname remains a separate EDGE/DNS/TLS gate."
