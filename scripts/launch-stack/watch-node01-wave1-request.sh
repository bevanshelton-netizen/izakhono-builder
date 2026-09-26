#!/usr/bin/env bash
set -euo pipefail

CODE_REPO="${IZAKHONO_WAVE1_CODE_REPO:-/var/lib/izakhono-code/repos/allegro-vibez.git}"
MARKER_PATH="${IZAKHONO_WAVE1_MARKER_PATH:-deploy/IZAKHONO_WAVE1_NODE01}"
MIRROR_REPO="${IZAKHONO_WAVE1_MIRROR_REPO:-bevanshelton-netizen/allegro-vibez}"
ALLOW_MIRROR="${IZAKHONO_WAVE1_ALLOW_GITHUB_MIRROR:-true}"
STATE_ROOT="${IZAKHONO_STATE_ROOT:-/opt/izakhono/state}"
EVIDENCE_ROOT="${IZAKHONO_EVIDENCE_ROOT:-/opt/izakhono/evidence}"
STATE_DIR="${STATE_ROOT}/wave1-request"
EVIDENCE_DIR="${EVIDENCE_ROOT}/wave1-request"
STATE_FILE="${STATE_DIR}/status.json"
LAST_OK_FILE="${STATE_DIR}/last-success.sha256"
LOCK_DIR="/run/izakhono-wave1-request.lock"
BUNDLE_ROOT="/opt/izakhono/wave1"
FULL_BRIDGE="/opt/izakhono/bin/run-wave1-local-proof"
ALLEGRO_BRIDGE="/opt/izakhono/bin/run-allegro-local-proof"

install -d -m 0750 "${STATE_DIR}" "${EVIDENCE_DIR}"

if ! mkdir "${LOCK_DIR}" 2>/dev/null; then
  echo '[WATCH] another owned Wave 1 request check is already running.'
  exit 0
fi
trap 'rmdir "$LOCK_DIR" >/dev/null 2>&1 || true' EXIT

write_state() {
  local status="$1" request_sha="$2" builder_ref="$3" allegro_ref="$4"
  local source_sha="$5" source_name="$6" scope="$7" detail="$8"
  python3 - "${STATE_FILE}" "$status" "$request_sha" "$builder_ref" "$allegro_ref" "$source_sha" "$source_name" "$scope" "$detail" <<'PY'
import json, os, sys, tempfile
from datetime import datetime, timezone
path,status,request_sha,builder_ref,allegro_ref,source_sha,source_name,scope,detail=sys.argv[1:]
payload={
  "schema":"izakhono.wave1.request-watch.v1",
  "checked_at":datetime.now(timezone.utc).isoformat(),
  "status":status,
  "request_sha256":request_sha or None,
  "builder_ref":builder_ref or None,
  "allegro_ref":allegro_ref or None,
  "source_commit":source_sha or None,
  "source":source_name or None,
  "source_priority":"izakhono-code-first",
  "scope":scope or None,
  "execution_authority":"IZAKHONO NODE01",
  "github_actions_required":False,
  "public_cutover_performed":False,
  "detail":detail,
}
directory=os.path.dirname(path); os.makedirs(directory,exist_ok=True)
fd,tmp=tempfile.mkstemp(prefix=".wave1-request-",dir=directory,text=True)
try:
  with os.fdopen(fd,"w",encoding="utf-8") as fh:
    json.dump(payload,fh,indent=2,sort_keys=True); fh.write("\n")
  os.chmod(tmp,0o640); os.replace(tmp,path)
finally:
  if os.path.exists(tmp): os.unlink(tmp)
print(json.dumps(payload,separators=(",",":")))
PY
}

source_name=""
source_sha=""
marker=""

if [ -d "${CODE_REPO}" ]; then
  candidate_sha="$(git --git-dir="${CODE_REPO}" rev-parse refs/heads/main 2>/dev/null || true)"
  candidate_marker="$(git --git-dir="${CODE_REPO}" show "refs/heads/main:${MARKER_PATH}" 2>/dev/null || true)"
  if [[ "$candidate_sha" =~ ^[0-9a-f]{40}$ ]] && [ -n "$candidate_marker" ]; then
    source_name="izakhono-code"
    source_sha="$candidate_sha"
    marker="$candidate_marker"
  fi
fi

if [ -z "$marker" ] && [ "$ALLOW_MIRROR" = "true" ]; then
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"; rmdir "$LOCK_DIR" >/dev/null 2>&1 || true' EXIT
  headers=(-H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' -H 'User-Agent: IZAKHONO-NODE01-Owned-Wave1/1.0')
  if [ -n "${IZAKHONO_GITHUB_TOKEN:-}" ]; then
    headers+=(-H "Authorization: Bearer ${IZAKHONO_GITHUB_TOKEN}")
  fi

  if curl --fail --silent --show-error --location "${headers[@]}"       "https://api.github.com/repos/${MIRROR_REPO}/commits/main" -o "$tmp_dir/commit.json"     && curl --fail --silent --show-error --location "${headers[@]}"       "https://api.github.com/repos/${MIRROR_REPO}/contents/${MARKER_PATH}?ref=main" -o "$tmp_dir/marker.json"; then
    readarray -t decoded < <(python3 - "$tmp_dir/commit.json" "$tmp_dir/marker.json" <<'PY'
import base64,json,sys
commit=json.load(open(sys.argv[1],encoding="utf-8"))
item=json.load(open(sys.argv[2],encoding="utf-8"))
sha=str(commit.get("sha") or "")
content=str(item.get("content") or "").replace("\n","")
try:
    marker=base64.b64decode(content,validate=True).decode("utf-8")
except Exception:
    marker=""
print(sha)
print(base64.b64encode(marker.encode()).decode())
PY
)
    candidate_sha="${decoded[0]:-}"
    marker_b64="${decoded[1]:-}"
    if [[ "$candidate_sha" =~ ^[0-9a-f]{40}$ ]] && [ -n "$marker_b64" ]; then
      candidate_marker="$(printf '%s' "$marker_b64" | base64 -d 2>/dev/null || true)"
      if [ -n "$candidate_marker" ]; then
        source_name="github-mirror"
        source_sha="$candidate_sha"
        marker="$candidate_marker"
      fi
    fi
  fi
fi

if [ -z "$marker" ]; then
  write_state "HOLD_NO_REQUEST_SOURCE" "" "" "" "" "" "" "No usable Wave 1 request was available from IZAKHONO CODE or the permitted mirror fallback."
  exit 0
fi

request_sha="$(printf '%s' "$marker" | sha256sum | awk '{print $1}')"
builder_ref="$(printf '%s\n' "$marker" | sed -n 's/^BUILDER_REF=//p' | head -n1)"
allegro_ref="$(printf '%s\n' "$marker" | sed -n 's/^ALLEGRO_REF=//p' | head -n1)"
mode="$(printf '%s\n' "$marker" | sed -n 's/^MODE=//p' | head -n1)"
public_cutover="$(printf '%s\n' "$marker" | sed -n 's/^PUBLIC_CUTOVER=//p' | head -n1)"
scope="$(printf '%s\n' "$marker" | sed -n 's/^SCOPE=//p' | head -n1)"
[ -n "$scope" ] || scope="WAVE1_ALL"

if [[ ! "$builder_ref" =~ ^[0-9a-f]{40}$ ]] || [[ ! "$allegro_ref" =~ ^[0-9a-f]{40}$ ]]; then
  write_state "HOLD_INVALID_REQUEST" "$request_sha" "$builder_ref" "$allegro_ref" "$source_sha" "$source_name" "$scope" "Wave 1 request does not contain immutable Builder/Allegro refs."
  exit 0
fi
if [ "$mode" != "LOCAL_OWNED_PROOF_ONLY" ] || [ "$public_cutover" != "false" ]; then
  write_state "HOLD_UNSAFE_REQUEST" "$request_sha" "$builder_ref" "$allegro_ref" "$source_sha" "$source_name" "$scope" "Only LOCAL_OWNED_PROOF_ONLY with PUBLIC_CUTOVER=false is permitted."
  exit 0
fi
case "$scope" in
  ALLEGRO_ONLY) BRIDGE="$ALLEGRO_BRIDGE" ;;
  WAVE1_ALL) BRIDGE="$FULL_BRIDGE" ;;
  *)
    write_state "HOLD_UNSAFE_SCOPE" "$request_sha" "$builder_ref" "$allegro_ref" "$source_sha" "$source_name" "$scope" "Unsupported owned deployment scope."
    exit 0
    ;;
esac

if [ -f "${LAST_OK_FILE}" ] && [ "$(tr -d '\r\n' < "${LAST_OK_FILE}")" = "$request_sha" ]; then
  write_state "PASS_ALREADY_EXECUTED" "$request_sha" "$builder_ref" "$allegro_ref" "$source_sha" "$source_name" "$scope" "This request was already proven successfully."
  exit 0
fi

installed_builder_ref=""
[ -f "${BUNDLE_ROOT}/BUILDER_REF" ] && installed_builder_ref="$(tr -d '\r\n' < "${BUNDLE_ROOT}/BUILDER_REF")"
if [ "$installed_builder_ref" != "$builder_ref" ]; then
  write_state "HOLD_BUILDER_BUNDLE_MISMATCH" "$request_sha" "$builder_ref" "$allegro_ref" "$source_sha" "$source_name" "$scope" "Installed Wave 1 bundle does not match the requested Builder ref."
  exit 0
fi

[ -x "${BRIDGE}" ] || {
  write_state "HOLD_BRIDGE_MISSING" "$request_sha" "$builder_ref" "$allegro_ref" "$source_sha" "$source_name" "$scope" "Fixed local proof bridge is unavailable."
  exit 0
}

systemctl start docker >/dev/null 2>&1 || true
systemctl start izakhono-node.service >/dev/null 2>&1 || true
systemctl start izakhono-control.service >/dev/null 2>&1 || true

if ! curl -fsS http://127.0.0.1:9191/readyz >/dev/null 2>&1 || ! curl -fsS http://127.0.0.1:9292/healthz >/dev/null 2>&1; then
  write_state "HOLD_NODE_CONTROL_NOT_READY" "$request_sha" "$builder_ref" "$allegro_ref" "$source_sha" "$source_name" "$scope" "NODE or CONTROL did not become healthy."
  exit 0
fi

echo "[OWNED EXECUTION] request=$request_sha scope=$scope source=$source_name authority=NODE01."
set +e
"${BRIDGE}"
rc=$?
set -e

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
receipt="${EVIDENCE_DIR}/wave1-request-${stamp}.json"
python3 - "${receipt}" "$request_sha" "$builder_ref" "$allegro_ref" "$source_sha" "$source_name" "$scope" "$rc" <<'PY'
import json,sys
from datetime import datetime,timezone
path,request_sha,builder_ref,allegro_ref,source_sha,source_name,scope,rc=sys.argv[1:]
payload={
 "schema":"izakhono.wave1.request-execution.v1",
 "executed_at":datetime.now(timezone.utc).isoformat(),
 "request_sha256":request_sha,
 "builder_ref":builder_ref,
 "allegro_ref":allegro_ref,
 "source_commit":source_sha,
 "source":source_name,
 "source_priority":"izakhono-code-first",
 "scope":scope,
 "execution_authority":"IZAKHONO NODE01",
 "github_actions_required":False,
 "bridge":"fixed-no-argument-root-owned",
 "returncode":int(rc),
 "result":"PASS_LOCAL_OWNED" if int(rc)==0 else "STOPPED_SAFE",
 "public_cutover_performed":False,
}
with open(path,"w",encoding="utf-8") as fh:
  json.dump(payload,fh,indent=2,sort_keys=True); fh.write("\n")
PY
chmod 0640 "${receipt}"
sha256sum "${receipt}" > "${receipt}.sha256"
chmod 0640 "${receipt}.sha256"

if [ "$rc" -eq 0 ]; then
  printf '%s\n' "$request_sha" > "${LAST_OK_FILE}"
  chmod 0640 "${LAST_OK_FILE}"
  write_state "PASS_LOCAL_OWNED" "$request_sha" "$builder_ref" "$allegro_ref" "$source_sha" "$source_name" "$scope" "Request executed successfully through CONTROL -> NODE."
  exit 0
fi

write_state "STOPPED_SAFE" "$request_sha" "$builder_ref" "$allegro_ref" "$source_sha" "$source_name" "$scope" "Owned proof returned non-zero; public traffic was not changed."
exit 0
