#!/usr/bin/env bash
set -euo pipefail

# Verify operator/runtime-produced four-node health evidence.
# This gate deliberately does not create or infer runtime evidence.

EVIDENCE_PATH="${1:-${CLUSTER_HEALTH_EVIDENCE_PATH:-}}"
if [[ -z "$EVIDENCE_PATH" || ! -f "$EVIDENCE_PATH" ]]; then
  echo "[BLOCKED] node-cluster evidence file is missing" >&2
  exit 10
fi

python3 - "$EVIDENCE_PATH" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
try:
    data = json.loads(path.read_text(encoding="utf-8"))
except Exception as exc:
    print(f"[BLOCKED] malformed node-cluster evidence: {exc}", file=sys.stderr)
    raise SystemExit(10)

if data.get("schema") != "izakhono.node-cluster-health.v1":
    print("[BLOCKED] invalid evidence schema", file=sys.stderr)
    raise SystemExit(10)
if data.get("cluster") != "izakhono-production":
    print("[BLOCKED] unexpected cluster identity", file=sys.stderr)
    raise SystemExit(10)
if data.get("runtimeEvidence") is not True:
    print("[BLOCKED] runtimeEvidence must be true", file=sys.stderr)
    raise SystemExit(10)
if data.get("status") != "PASS":
    print("[BLOCKED] four-node runtime status is not PASS", file=sys.stderr)
    raise SystemExit(10)
if data.get("requiredHealthyNodes") != 4:
    print("[BLOCKED] requiredHealthyNodes must equal 4", file=sys.stderr)
    raise SystemExit(10)

expected = {"NODE01", "NODE02", "NODE03", "NODE04"}
for field in ("nodes", "healthyNodes"):
    values = data.get(field)
    if not isinstance(values, list) or set(values) != expected or len(values) != 4:
        print(f"[BLOCKED] {field} must contain exactly NODE01-NODE04", file=sys.stderr)
        raise SystemExit(10)

source = str(data.get("source", "")).lower()
for forbidden in ("simulated", "inferred", "topology", "ci-only", "repository-only"):
    if forbidden in source:
        print(f"[BLOCKED] forbidden evidence source: {source}", file=sys.stderr)
        raise SystemExit(10)

if not data.get("timestamp"):
    print("[BLOCKED] runtime evidence timestamp missing", file=sys.stderr)
    raise SystemExit(10)

print("[PASS] four-node runtime evidence verified: NODE01 NODE02 NODE03 NODE04")
PY
