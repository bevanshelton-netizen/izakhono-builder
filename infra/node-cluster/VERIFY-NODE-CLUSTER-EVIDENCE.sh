#!/usr/bin/env bash
set -euo pipefail

# Verify runtime-produced four-node health evidence emitted by
# NODE-CLUSTER-HEALTH-GATE.sh. This gate never creates or infers evidence.

EVIDENCE_PATH="${1:-${CLUSTER_HEALTH_EVIDENCE_PATH:-}}"
if [[ -z "$EVIDENCE_PATH" || ! -f "$EVIDENCE_PATH" ]]; then
  echo "[BLOCKED] node-cluster evidence file is missing" >&2
  exit 10
fi

python3 - "$EVIDENCE_PATH" <<'PY'
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

path = Path(sys.argv[1])
MAX_AGE_SECONDS = 300

def parse_fresh_timestamp(value, label):
    try:
        stamp = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if stamp.tzinfo is None:
            blocked(f"{label} timestamp must include a timezone")
        age = (datetime.now(timezone.utc) - stamp.astimezone(timezone.utc)).total_seconds()
        if age < -30 or age > MAX_AGE_SECONDS:
            blocked(f"{label} timestamp is outside the allowed 5-minute evidence window")
    except SystemExit:
        raise
    except Exception:
        blocked(f"{label} timestamp is invalid")

def blocked(message):
    print(f"[BLOCKED] {message}", file=sys.stderr)
    raise SystemExit(10)

try:
    data = json.loads(path.read_text(encoding="utf-8"))
except Exception as exc:
    blocked(f"malformed node-cluster evidence: {exc}")

if not isinstance(data, dict):
    blocked("evidence root must be an object")
if data.get("schema") != "izakhono.node-cluster-health.v1":
    blocked("invalid evidence schema")
if data.get("cluster") != "izakhono-production":
    blocked("unexpected cluster identity")
if data.get("nodeIdentityType") != "software-runtime":
    blocked("node identity must be software-runtime")
if data.get("physicalHostIsSeparate") is not True:
    blocked("logical runtime node identity was not declared")
if data.get("runtimeEvidence") is not True:
    blocked("runtimeEvidence must be true")
if data.get("status") != "PASS":
    blocked("four-node runtime status is not PASS")
if data.get("requiredHealthyNodes") != 4:
    blocked("requiredHealthyNodes must equal 4")

expected = {"NODE01", "NODE02", "NODE03", "NODE04"}
nodes = data.get("nodes")
if not isinstance(nodes, list) or len(nodes) != 4:
    blocked("nodes must contain exactly four runtime records")

seen = set()
for record in nodes:
    if not isinstance(record, dict):
        blocked("each node record must be an object")
    name = record.get("node")
    if name not in expected or name in seen:
        blocked("node records must contain each of NODE01-NODE04 exactly once")
    seen.add(name)
    if record.get("identityType") != "software-runtime":
        blocked(f"{name} is not identified as a software runtime")
    if record.get("physicalHostIsSeparate") is not True:
        blocked(f"{name} physical-host separation declaration is missing")
    if record.get("status") != "PASS" or record.get("runtime_evidence") is not True:
        blocked(f"{name} does not have passing runtime evidence")
    if not record.get("checkedAt"):
        blocked(f"{name} runtime timestamp is missing")
    parse_fresh_timestamp(record["checkedAt"], f"{name} runtime")

if seen != expected:
    blocked("runtime evidence does not cover NODE01-NODE04")

healthy = data.get("healthyNodes")
if not isinstance(healthy, list) or len(healthy) != 4 or set(healthy) != expected:
    blocked("healthyNodes must contain exactly NODE01-NODE04")

if data.get("source") != "operator-supplied-runtime-endpoints":
    blocked("evidence source is not the runtime endpoint health gate")

checked_at = data.get("checkedAt")
if not checked_at:
    blocked("cluster runtime evidence timestamp is missing")
parse_fresh_timestamp(checked_at, "cluster runtime")

print("[PASS] four-node runtime evidence verified: NODE01 NODE02 NODE03 NODE04")
PY
