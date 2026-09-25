#!/usr/bin/env bash
set -euo pipefail

REPO="${IZAKHONO_WAVE1_REPO:-bevanshelton-netizen/allegro-vibez}"
RUN_ID="${IZAKHONO_WAVE1_RUN_ID:-36089278026}"
API_URL="https://api.github.com/repos/${REPO}/actions/runs/${RUN_ID}"
EVIDENCE_ROOT="${IZAKHONO_EVIDENCE_ROOT:-/opt/izakhono/evidence}"
STATE_ROOT="${IZAKHONO_STATE_ROOT:-/opt/izakhono/state}"
ALERT_DIR="${EVIDENCE_ROOT}/alerts"
WATCH_DIR="${STATE_ROOT}/watchers"
STATE_FILE="${WATCH_DIR}/node01-wave1.json"
MARKER_FILE="${WATCH_DIR}/node01-wave1.notified"
ALERT_FILE="${ALERT_DIR}/node01-wave1-finished.json"

install -d -m 0750 "${ALERT_DIR}" "${WATCH_DIR}"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

headers=(-H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2022-11-28' -H 'User-Agent: IZAKHONO-NODE01-Wave1-Watch/1.0')
if [ -n "${IZAKHONO_GITHUB_TOKEN:-}" ]; then
  headers+=(-H "Authorization: Bearer ${IZAKHONO_GITHUB_TOKEN}")
fi

curl --fail --silent --show-error --location "${headers[@]}" "${API_URL}" -o "$tmp"

set +e
python3 - "$tmp" "$STATE_FILE" "$MARKER_FILE" "$ALERT_FILE" "$REPO" "$RUN_ID" <<'PY'
import json
import os
import sys
import tempfile
from datetime import datetime, timezone

source, state_file, marker_file, alert_file, repo, run_id = sys.argv[1:]
with open(source, "r", encoding="utf-8") as fh:
    run = json.load(fh)

status = str(run.get("status") or "unknown")
conclusion = run.get("conclusion")
url = run.get("html_url") or f"https://github.com/{repo}/actions/runs/{run_id}"
checked_at = datetime.now(timezone.utc).isoformat()

state = {
    "schema": "izakhono.node01.watch.v1",
    "watch": "NODE01 Wave 1",
    "repository": repo,
    "run_id": int(run_id),
    "status": status,
    "conclusion": conclusion,
    "run_url": url,
    "run_updated_at": run.get("updated_at"),
    "checked_at": checked_at,
    "execution_authority": "IZAKHONO NODE01",
    "chatgpt_scheduler_required": False,
}

def atomic_json(path, payload):
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".izakhono-", dir=directory, text=True)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, sort_keys=True)
            fh.write("\n")
        os.chmod(tmp, 0o640)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)

atomic_json(state_file, state)

if status != "completed":
    print(f"[WATCH] NODE01 Wave 1 is {status}.")
    raise SystemExit(0)

if os.path.exists(marker_file):
    print(f"[WATCH] NODE01 Wave 1 already recorded as completed ({conclusion}).")
    raise SystemExit(0)

alert = {
    **state,
    "event": "NODE01_WAVE1_FINISHED",
    "message": f"NODE01 Wave 1 finished with conclusion: {conclusion}.",
    "machine_proof": (
        "WORKFLOW_SUCCESS_REVIEW_REPORT"
        if conclusion == "success"
        else "WORKFLOW_DID_NOT_PASS"
    ),
    "next_gate": (
        "Review IZAKHONO-NODE01-WAVE1-REPORT.json before EDGE/DNS/TLS promotion."
        if conclusion == "success"
        else "Inspect the first actionable failed step; preserve external production fallback."
    ),
}
atomic_json(alert_file, alert)
with open(marker_file, "w", encoding="utf-8") as fh:
    fh.write(checked_at + "\n")
os.chmod(marker_file, 0o640)
print(f"[ALERT] NODE01 Wave 1 completed: {conclusion}")
raise SystemExit(10)
PY
rc=$?
set -e

if [ "$rc" -eq 10 ]; then
  if [ -n "${IZAKHONO_ALERT_WEBHOOK_URL:-}" ]; then
    curl --fail --silent --show-error --location \
      -H 'Content-Type: application/json' \
      --data-binary "@${ALERT_FILE}" \
      "${IZAKHONO_ALERT_WEBHOOK_URL}" \
      || echo '[WARN] Owned alert was recorded, but the optional webhook adapter did not accept it.'
  fi

  if [ -d /mnt/c/ProgramData/IZAKHONO ] && [ -w /mnt/c/ProgramData/IZAKHONO ]; then
    mkdir -p /mnt/c/ProgramData/IZAKHONO/alerts || true
    cp "${ALERT_FILE}" /mnt/c/ProgramData/IZAKHONO/alerts/NODE01-WAVE1-FINISHED.json || true
  fi
  exit 0
fi

exit "$rc"
