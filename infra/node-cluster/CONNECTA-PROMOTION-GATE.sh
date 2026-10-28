#!/usr/bin/env bash
set -euo pipefail

# CONNECTA production promotion gate.
# This gate NEVER creates runtime evidence and NEVER authorizes public traffic by itself.
# It requires independently produced four-node runtime evidence before any promotion step
# may proceed to the remaining deployment/EDGE/TLS/DNS/smoke/rollback gates.

EVIDENCE_PATH="${1:-${CLUSTER_HEALTH_EVIDENCE_PATH:-}}"
if [[ -z "$EVIDENCE_PATH" ]]; then
  echo "[BLOCKED] CLUSTER_HEALTH_EVIDENCE_PATH is required." >&2
  exit 10
fi

bash "$(dirname "$0")/VERIFY-NODE-CLUSTER-EVIDENCE.sh" "$EVIDENCE_PATH"

python3 - "$EVIDENCE_PATH" <<'PY'
import json
import sys
from pathlib import Path

p = Path(sys.argv[1])
data = json.loads(p.read_text(encoding="utf-8"))

# Promotion is only eligible for the canonical CONNECTA owned cluster.
if data.get("cluster") != "izakhono-production":
    print("[BLOCKED] promotion cluster identity mismatch", file=sys.stderr)
    raise SystemExit(10)
if data.get("runtimeEvidence") is not True:
    print("[BLOCKED] promotion requires runtime-produced evidence", file=sys.stderr)
    raise SystemExit(10)
if data.get("status") != "PASS":
    print("[BLOCKED] four-node runtime health is not PASS", file=sys.stderr)
    raise SystemExit(10)

print("[PASS] CONNECTA promotion prerequisite satisfied: NODE01 NODE02 NODE03 NODE04 runtime evidence verified.")
print("[INFO] Continue only through the remaining production gates: immutable release, deployment, EDGE, TLS, DNS, public smoke and rollback.")
PY
