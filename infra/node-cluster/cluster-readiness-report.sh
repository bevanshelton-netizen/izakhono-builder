#!/usr/bin/env bash
set -euo pipefail

# Run on NODE01 after the physical nodes have produced readiness evidence.
# This script never invents node state and never treats topology as evidence.

EVIDENCE_ROOT="${IZAKHONO_EVIDENCE_ROOT:-/var/lib/izakhono/evidence}"
REPORT="${IZAKHONO_CLUSTER_REPORT:-$EVIDENCE_ROOT/cluster-readiness.json}"
MAX_AGE_SECONDS="${IZAKHONO_READINESS_MAX_AGE_SECONDS:-86400}"
EXPECTED=(node01 node02 node03 node04)

mkdir -p "$EVIDENCE_ROOT"
chmod 700 "$EVIDENCE_ROOT"

python3 - "$EVIDENCE_ROOT" "$REPORT" "$MAX_AGE_SECONDS" "${EXPECTED[@]}" <<'PY'
import json, os, sys, time
from pathlib import Path

root = Path(sys.argv[1])
report = Path(sys.argv[2])
try:
    max_age = int(sys.argv[3])
except ValueError:
    raise SystemExit("invalid IZAKHONO_READINESS_MAX_AGE_SECONDS")
expected = sys.argv[4:]
now = int(time.time())
failures = []
nodes = []

for node in expected:
    path = root / f"node-readiness-{node}.json"
    if not path.is_file():
        failures.append(f"missing-evidence:{node}")
        nodes.append({"node_id": node, "status": "MISSING_EVIDENCE"})
        continue
    try:
        with path.open(encoding="utf-8") as f:
            d = json.load(f)
    except Exception as exc:
        failures.append(f"invalid-json:{node}")
        nodes.append({"node_id": node, "status": "INVALID", "error": str(exc)})
        continue

    errors = []
    if d.get("schema") != "izakhono.node-readiness.v2":
        errors.append("schema")
    if d.get("node_id") != node:
        errors.append("node_id")
    if d.get("status") != "PASS":
        errors.append("status")
    if d.get("evidence_source") != "physical-node-execution":
        errors.append("evidence_source")
    checked = d.get("checked_at_epoch")
    if not isinstance(checked, int) or checked <= 0:
        errors.append("checked_at_epoch")
    elif checked > now + 300:
        errors.append("future_timestamp")
    elif now - checked > max_age:
        errors.append("stale_evidence")
    if d.get("failures") != []:
        errors.append("failures")

    if errors:
        failures.extend(f"{node}:{item}" for item in errors)

    nodes.append({
        "node_id": d.get("node_id"),
        "hostname": d.get("hostname"),
        "status": d.get("status"),
        "checked_at_epoch": checked,
        "evidence_source": d.get("evidence_source"),
        "validation": "PASS" if not errors else "FAIL",
        "errors": errors,
    })

status = "PHYSICALLY_VERIFIED" if not failures else "NOT_READY"
record = {
    "schema": "izakhono.cluster-readiness.v1",
    "checked_at_epoch": now,
    "status": status,
    "required_nodes": expected,
    "max_evidence_age_seconds": max_age,
    "failures": failures,
    "nodes": nodes,
    "production_ready": False,
    "production_ready_reason": "Physical node evidence alone is insufficient; quorum, failover, backup/restore, encrypted networking/secrets, EDGE/TLS and independent HTTPS acceptance remain required.",
    "evidence_source": "physical-node-evidence-aggregation",
}

tmp = report.with_suffix(report.suffix + ".tmp")
with tmp.open("w", encoding="utf-8") as f:
    json.dump(record, f, indent=2, sort_keys=True)
    f.write("\n")
os.chmod(tmp, 0o600)
os.replace(tmp, report)
print(json.dumps(record, indent=2, sort_keys=True))
if status != "PHYSICALLY_VERIFIED":
    raise SystemExit(4)
print("IZAKHONO_CLUSTER_PHYSICAL_READINESS=PASS")
print(f"EVIDENCE={report}")
PY