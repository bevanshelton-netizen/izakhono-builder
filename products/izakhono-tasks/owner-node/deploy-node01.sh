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

bash "$REPO_ROOT/products/izakhono-tasks/owner-node/prepare-env.sh"
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
  "app":"izakhono-tasks",
  "ref":sha,
  "environment":"production",
  "mode":"single",
  "container_port":9991,
  "health_path":"/healthz",
  "data_path":"/app/data",
  "dockerfile":"products/izakhono-tasks/Dockerfile.node",
  "env_file":"/etc/izakhono/apps/izakhono-tasks.env"
}, separators=(",",":")))
PY
)"

RESPONSE="$(curl -fsS -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "$JOB" \
  "$CONTROL_URL/v1/deploy")"

JOB_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' <<<"$RESPONSE")"
[ -n "$JOB_ID" ] || { echo "[STOP] CONTROL did not return a deployment job id."; exit 12; }
echo "IZAKHONO_TASKS_JOB=$JOB_ID"

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
  echo "[FAIL] TASKS NODE01 deployment status: $status"
  echo "$detail"
  exit 13
}

HEALTH="$(curl -fsS http://127.0.0.1:9991/healthz)"
python3 - "$SHA" "$JOB_ID" "$HEALTH" <<'PY'
import json,sys,time,pathlib
sha,job_id,health_raw=sys.argv[1:4]
health=json.loads(health_raw)
ok=bool(health.get("ok")) and bool(health.get("flow_adapter_configured"))
report={
  "schema":"izakhono.tasks.node01.v1",
  "generated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "app":"izakhono-tasks",
  "commit":sha,
  "job_id":job_id,
  "local_ready":ok,
  "health":health,
  "public_required":False
}
path=pathlib.Path("/var/lib/izakhono-node/evidence/izakhono-tasks-node01.json")
path.write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
if not ok:
    raise SystemExit(14)
PY

echo "[PASS] IZAKHONO TASKS is healthy on NODE01 localhost."

if [ "${TASKS_BIND_FLOWIQ:-true}" = "true" ]; then
  echo "[NEXT] Binding FLOWIQ to IZAKHONO TASKS over the internal NODE01 network..."
  bash "$REPO_ROOT/products/izakhono-flowiq/owner-node/prepare-env.sh"

  TASKS_FLOW_SECRET="$(awk -F= '$1=="IZAKHONO_TASKS_FLOW_TOKEN"{sub(/^[^=]*=/,"");print;exit}' /etc/izakhono/apps/izakhono-tasks.env)"
  [ -n "$TASKS_FLOW_SECRET" ] || { echo "[FAIL] TASKS flow token is missing."; exit 15; }

  python3 - "$TASKS_FLOW_SECRET" <<'PY'
from pathlib import Path
import os,sys
path=Path("/etc/izakhono/apps/izakhono-flowiq.env")
secret=sys.argv[1]
updates={
  "FLOWIQ_TASKS_URL":"http://izakhono-tasks:9991",
  "FLOWIQ_TASKS_TOKEN":secret,
}
lines=path.read_text().splitlines() if path.exists() else []
out=[]; seen=set()
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
  unset TASKS_FLOW_SECRET

  FLOWIQ_BIND_DOCFLOW=true bash "$REPO_ROOT/products/izakhono-flowiq/owner-node/deploy-node01.sh" "$REPO_ROOT"

  FLOW_READY="$(curl -fsS http://127.0.0.1:9797/readyz)"
  python3 - "$FLOW_READY" <<'PY'
import json,sys
d=json.loads(sys.argv[1])
assert d.get("ok") is True
assert d.get("adapters",{}).get("tasks") is True
print("[PASS] FLOWIQ reports IZAKHONO TASKS as a configured adapter.")
PY

  docker exec izakhono-flowiq node -e "fetch('http://izakhono-tasks:9991/healthz').then(r=>{if(!r.ok)process.exit(2);return r.json()}).then(d=>{if(!d.ok)process.exit(3);console.log('[PASS] FLOWIQ container can reach IZAKHONO TASKS privately.')}).catch(e=>{console.error(e);process.exit(4)})"
fi

echo "[PASS] TASKS -> FLOWIQ -> DOCFLOW internal workflow chain prepared."
echo "[BOUNDARY] No public DNS was required or changed."
