#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="${1:-}"
HOSTNAME="${2:-}"
CONTROL_URL="${IZAKHONO_CONTROL_URL:-http://127.0.0.1:9292}"
TOKEN_FILE="${IZAKHONO_CONTROL_TOKEN_FILE:-/etc/izakhono/control.owner-token}"
OWNED_REPO=/var/lib/izakhono-code/repos/izakhono-builder.git

if [ "${EUID:-$(id -u)}" -ne 0 ]; then exec sudo -E bash "$0" "$@"; fi
[ -n "$REPO_ROOT" ] && [ -n "$HOSTNAME" ] || { echo "[STOP] repo root and hostname required."; exit 2; }
[[ "$HOSTNAME" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ ]] || { echo "[STOP] Invalid hostname."; exit 3; }

bash "$REPO_ROOT/products/izakhono-sign/owner-node/prepare-env.sh"
python3 - "$HOSTNAME" <<'PY'
from pathlib import Path
import os,sys
hostname=sys.argv[1]
path=Path("/etc/izakhono/apps/izakhono-sign.env")
updates={"SIGN_PUBLIC_BASE_URL":"https://"+hostname}
lines=path.read_text().splitlines() if path.exists() else []
out=[];seen=set()
for line in lines:
    key=line.split("=",1)[0] if "=" in line else ""
    if key in updates:
        out.append(f"{key}={updates[key]}");seen.add(key)
    else:out.append(line)
for k,v in updates.items():
    if k not in seen:out.append(f"{k}={v}")
tmp=path.with_suffix(".tmp");tmp.write_text("\n".join(out)+"\n");os.chmod(tmp,0o600);tmp.replace(path);os.chmod(path,0o600)
PY

bash "$REPO_ROOT/products/izakhono-node/sync-builder-to-code.sh" "$REPO_ROOT"
SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
git --git-dir="$OWNED_REPO" cat-file -e "$SHA^{commit}" || { echo "[STOP] Commit missing from IZAKHONO CODE."; exit 4; }
[ -f "$TOKEN_FILE" ] || { echo "[STOP] CONTROL token missing."; exit 5; }
TOKEN="$(tr -d '\r\n' <"$TOKEN_FILE")"

JOB="$(python3 - "$SHA" <<'PY'
import json,sys
sha=sys.argv[1]
print(json.dumps({"source":"izakhono-code","repository":"izakhono-builder","app":"izakhono-sign","ref":sha,"environment":"production","mode":"single","container_port":9898,"health_path":"/readyz","data_path":"/app/data","dockerfile":"products/izakhono-sign/Dockerfile.node","env_file":"/etc/izakhono/apps/izakhono-sign.env"},separators=(",",":")))
PY
)"
R="$(curl -fsS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-binary "$JOB" "$CONTROL_URL/v1/deploy")"
ID="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' <<<"$R")"
[ -n "$ID" ] || exit 6
status=""
for _ in $(seq 1 300); do
  D="$(curl -fsS -H "Authorization: Bearer $TOKEN" "$CONTROL_URL/v1/jobs/$ID")"
  status="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",""))' <<<"$D")"
  case "$status" in succeeded|failed|timed_out|interrupted) break;; esac
  sleep 3
done
[ "$status" = succeeded ] || { echo "[FAIL] SIGN redeploy status=$status"; exit 7; }

READY="$(curl -fsS http://127.0.0.1:9898/readyz)"
python3 - "$HOSTNAME" "$READY" <<'PY'
import json,sys
host=sys.argv[1];d=json.loads(sys.argv[2])
assert d.get("ok") is True
assert d.get("public_route_configured") is True
print("[PASS] SIGN runtime public base configured for https://"+host)
PY
