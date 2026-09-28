#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-}"
CONTROL_URL="${IZAKHONO_CONTROL_URL:-http://127.0.0.1:9292}"
TOKEN_FILE="${IZAKHONO_CONTROL_TOKEN_FILE:-/etc/izakhono/control.owner-token}"
OWNED_REPO=/var/lib/izakhono-code/repos/izakhono-builder.git

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

[ -n "$REPO_ROOT" ] || { echo "[STOP] Pass the checked-out izakhono-builder repository root."; exit 2; }
REPO_ROOT="$(readlink -f "$REPO_ROOT")"
[ -d "$REPO_ROOT/.git" ] || { echo "[STOP] Not a Git checkout: $REPO_ROOT"; exit 3; }

for cmd in git curl python3 docker; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "[STOP] Missing $cmd."; exit 4; }
done

curl -fsS "$CONTROL_URL/healthz" >/dev/null || { echo "[STOP] IZAKHONO CONTROL is not healthy."; exit 5; }
curl -fsS "http://127.0.0.1:9191/readyz" >/dev/null || { echo "[STOP] IZAKHONO NODE is not ready."; exit 6; }
[ -f "$TOKEN_FILE" ] || { echo "[STOP] CONTROL owner token is missing."; exit 7; }
TOKEN="$(tr -d '\r\n' <"$TOKEN_FILE")"
[ -n "$TOKEN" ] || { echo "[STOP] CONTROL owner token is empty."; exit 8; }

bash "$REPO_ROOT/products/izakhono-flowiq/owner-node/prepare-env.sh"
bash "$REPO_ROOT/products/izakhono-node/sync-builder-to-code.sh" "$REPO_ROOT"

SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "[STOP] Could not resolve immutable source commit."; exit 9; }
[ -d "$OWNED_REPO" ] || { echo "[STOP] IZAKHONO CODE repository is missing after sync."; exit 10; }
git --git-dir="$OWNED_REPO" cat-file -e "$SHA^{commit}" || { echo "[STOP] Commit $SHA is not present in IZAKHONO CODE."; exit 11; }

JOB="$(python3 - "$SHA" <<'PY'
import json,sys
sha=sys.argv[1]
print(json.dumps({
  "source":"izakhono-code",
  "repository":"izakhono-builder",
  "app":"izakhono-flowiq",
  "ref":sha,
  "environment":"production",
  "mode":"single",
  "container_port":9797,
  "health_path":"/readyz",
  "data_path":"/app/data",
  "dockerfile":"products/izakhono-flowiq/Dockerfile.node",
  "env_file":"/etc/izakhono/apps/izakhono-flowiq.env"
}, separators=(",",":")))
PY
)"

RESPONSE="$(curl -fsS -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "$JOB" \
  "$CONTROL_URL/v1/deploy")"

JOB_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' <<<"$RESPONSE")"
[ -n "$JOB_ID" ] || { echo "[STOP] CONTROL did not return a deployment job id."; echo "$RESPONSE"; exit 12; }
echo "IZAKHONO_FLOWIQ_JOB=$JOB_ID"

status=""
detail=""
for _ in $(seq 1 300); do
  detail="$(curl -fsS -H "Authorization: Bearer $TOKEN" "$CONTROL_URL/v1/jobs/$JOB_ID")"
  status="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"$detail")"
  case "$status" in
    succeeded|failed|timed_out|interrupted) break ;;
  esac
  sleep 3
done

[ "$status" = "succeeded" ] || {
  echo "[FAIL] FLOWIQ NODE01 deployment status: $status"
  echo "$detail"
  exit 13
}

READY="$(curl -fsS http://127.0.0.1:9797/readyz)"
python3 - "$SHA" "$JOB_ID" "$READY" <<'PY'
import json,sys,time,pathlib
sha,job_id,ready_raw=sys.argv[1:4]
ready=json.loads(ready_raw)
ok=bool(ready.get("ok")) and ready.get("database")=="ready" and bool(ready.get("auth_configured"))
report={
  "schema":"izakhono.flowiq.node01.v1",
  "generated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "app":"izakhono-flowiq",
  "commit":sha,
  "job_id":job_id,
  "local_ready":ok,
  "readiness":ready,
  "public_required":False
}
path=pathlib.Path("/var/lib/izakhono-node/evidence/izakhono-flowiq-node01.json")
path.write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
if not ok:
    raise SystemExit(14)
PY

echo "[PASS] IZAKHONO FLOWIQ is healthy on NODE01 localhost."

if [ "${FLOWIQ_BIND_DOCFLOW:-true}" = "true" ]; then
  echo "[NEXT] Binding DOCFLOW to the verified FLOWIQ service over the IZAKHONO internal network..."

  bash "$REPO_ROOT/products/izakhono-docflow/owner-node/prepare-env.sh"
  FLOWIQ_SECRET="$(awk -F= '$1=="FLOWIQ_TOKEN"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/apps/izakhono-flowiq.env)"
  [ -n "$FLOWIQ_SECRET" ] || { echo "[FAIL] FLOWIQ token could not be read from the owner environment."; exit 15; }

  python3 - "$FLOWIQ_SECRET" <<'PY'
from pathlib import Path
import os,sys,tempfile
path=Path("/etc/izakhono/apps/izakhono-docflow.env")
secret=sys.argv[1]
lines=path.read_text().splitlines() if path.exists() else []
updates={
  "FLOWIQ_URL":"http://izakhono-flowiq:9797",
  "FLOWIQ_TOKEN":secret,
}
out=[]
seen=set()
for line in lines:
    if "=" in line:
        key=line.split("=",1)[0]
        if key in updates:
            out.append(f"{key}={updates[key]}")
            seen.add(key)
            continue
    out.append(line)
for key,value in updates.items():
    if key not in seen:
        out.append(f"{key}={value}")
tmp=path.with_suffix(".tmp")
tmp.write_text("\n".join(out)+"\n")
os.chmod(tmp,0o600)
tmp.replace(path)
os.chmod(path,0o600)
PY
  unset FLOWIQ_SECRET

  DOCFLOW_JOB="$(python3 - "$SHA" <<'PY'
import json,sys
sha=sys.argv[1]
print(json.dumps({
  "source":"izakhono-code",
  "repository":"izakhono-builder",
  "app":"izakhono-docflow",
  "ref":sha,
  "environment":"production",
  "mode":"single",
  "container_port":8787,
  "health_path":"/api/ready",
  "data_path":"/app/data",
  "dockerfile":"products/izakhono-docflow/Dockerfile.node",
  "env_file":"/etc/izakhono/apps/izakhono-docflow.env"
}, separators=(",",":")))
PY
)"

  DOCFLOW_RESPONSE="$(curl -fsS -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary "$DOCFLOW_JOB" \
    "$CONTROL_URL/v1/deploy")"
  DOCFLOW_JOB_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' <<<"$DOCFLOW_RESPONSE")"
  [ -n "$DOCFLOW_JOB_ID" ] || { echo "[FAIL] CONTROL did not return a DOCFLOW deployment job id."; exit 16; }

  docflow_status=""
  docflow_detail=""
  for _ in $(seq 1 300); do
    docflow_detail="$(curl -fsS -H "Authorization: Bearer $TOKEN" "$CONTROL_URL/v1/jobs/$DOCFLOW_JOB_ID")"
    docflow_status="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"$docflow_detail")"
    case "$docflow_status" in
      succeeded|failed|timed_out|interrupted) break ;;
    esac
    sleep 3
  done

  [ "$docflow_status" = "succeeded" ] || {
    echo "[FAIL] DOCFLOW redeployment for FLOWIQ binding status: $docflow_status"
    echo "$docflow_detail"
    exit 17
  }

  DOCFLOW_READY="$(curl -fsS http://127.0.0.1:8787/api/ready)"
  python3 - "$DOCFLOW_READY" <<'PY'
import json,sys
d=json.loads(sys.argv[1])
assert d.get("ok") is True
assert d.get("database")=="ready"
assert d.get("owner_secret_configured") is True
assert d.get("adapters",{}).get("flowiq") is True
print("[PASS] DOCFLOW reports the FLOWIQ adapter as bound.")
PY

  docker exec izakhono-docflow node -e "fetch('http://izakhono-flowiq:9797/healthz').then(r=>{if(!r.ok)process.exit(2);return r.json()}).then(d=>{if(!d.ok)process.exit(3);console.log('[PASS] DOCFLOW container can reach FLOWIQ on the IZAKHONO internal network.')}).catch(e=>{console.error(e);process.exit(4)})"

  python3 - "$SHA" "$DOCFLOW_JOB_ID" <<'PY'
import json,sys,time,pathlib
sha,job_id=sys.argv[1:3]
report={
  "schema":"izakhono.flowiq.docflow.binding.v1",
  "generated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "flowiq_url":"http://izakhono-flowiq:9797",
  "docflow_commit":sha,
  "docflow_job_id":job_id,
  "container_network_reachability":True,
  "secret_printed":False
}
path=pathlib.Path("/var/lib/izakhono-node/evidence/izakhono-flowiq-docflow-binding.json")
path.write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
PY
fi

echo "[PASS] FLOWIQ NODE01 workflow layer prepared."
echo "[BOUNDARY] FLOWIQ remains an internal service; no public DNS was changed."
