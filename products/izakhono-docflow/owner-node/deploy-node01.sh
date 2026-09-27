#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${1:-}"
CONTROL_URL="${IZAKHONO_CONTROL_URL:-http://127.0.0.1:9292}"
TOKEN_FILE="${IZAKHONO_CONTROL_TOKEN_FILE:-/etc/izakhono/control.owner-token}"
OWNED_REPO=/var/lib/izakhono-code/repos/izakhono-builder.git
APP=izakhono-docflow

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

bash "$REPO_ROOT/products/izakhono-docflow/owner-node/prepare-env.sh"
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

RESPONSE="$(curl -fsS -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "$JOB" \
  "$CONTROL_URL/v1/deploy")"

JOB_ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' <<<"$RESPONSE")"
[ -n "$JOB_ID" ] || { echo "[STOP] CONTROL did not return a deployment job id."; echo "$RESPONSE"; exit 12; }
echo "IZAKHONO_DOCFLOW_JOB=$JOB_ID"

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
  echo "[FAIL] DOCFLOW NODE01 deployment status: $status"
  echo "$detail"
  exit 13
}

READY="$(curl -fsS http://127.0.0.1:8787/api/ready)"
python3 - "$SHA" "$JOB_ID" "$READY" <<'PY'
import json,sys,time,hashlib,pathlib
sha,job_id,ready_raw=sys.argv[1:4]
ready=json.loads(ready_raw)
ok=bool(ready.get("ok")) and ready.get("database")=="ready" and bool(ready.get("owner_secret_configured"))
report={
  "schema":"izakhono.docflow.node01.v1",
  "generated_at":time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
  "app":"izakhono-docflow",
  "commit":sha,
  "job_id":job_id,
  "local_ready":ok,
  "readiness":ready,
  "public_live":False,
  "next_gate":"EDGE_TLS_DNS_PUBLIC_ACCEPTANCE"
}
path=pathlib.Path("/var/lib/izakhono-node/evidence/izakhono-docflow-node01.json")
path.write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
if not ok:
    raise SystemExit(14)
PY

echo "[PASS] IZAKHONO DOCFLOW is healthy on NODE01 localhost."

echo "[NEXT] Proving backup + isolated restore before any public cutover..."
DOCFLOW_CONTAINER=izakhono-docflow \
  bash "$REPO_ROOT/products/izakhono-docflow/owner-node/prove-backup-restore.sh"

echo "[PASS] NODE01 runtime plus backup/restore proof completed."
echo "[BOUNDARY] No DNS or public EDGE cutover was performed."
