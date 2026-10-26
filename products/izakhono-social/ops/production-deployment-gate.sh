#!/usr/bin/env bash
set -euo pipefail

# CONNECTA production deployment gate.
# This gate is fail-closed: it authorizes promotion only when all supplied
# evidence artifacts are fresh, PASS, schema-correct, and sourced from an
# actual operator-controlled runtime. It never performs DNS/TLS cutover.

EVIDENCE_DIR="${CONNECTA_EVIDENCE_DIR:-/var/lib/izakhono/evidence/connecta}"
MAX_AGE="${CONNECTA_READINESS_MAX_AGE_SECONDS:-86400}"
REPORT="${CONNECTA_PROMOTION_REPORT:-${EVIDENCE_DIR}/promotion-gate.json}"

python3 - "$EVIDENCE_DIR" "$MAX_AGE" "$REPORT" <<'PY'
import json, os, sys, time

evidence_dir, max_age_raw, report_path = sys.argv[1:]
max_age = int(max_age_raw)
now = int(time.time())

required = {
    "cluster-physical.json": "izakhono.connecta.gate.cluster-physical.v1",
    "connecta-local.json": "izakhono.connecta.gate.local.v1",
    "failover.json": "izakhono.connecta.gate.failover.v1",
    "backup-restore.json": "izakhono.connecta.gate.backup-restore.v1",
    "security.json": "izakhono.connecta.gate.security.v1",
    "edge-tls.json": "izakhono.connecta.gate.edge-tls.v1",
    "external-https.json": "izakhono.connecta.gate.external-https.v1",
}

failures=[]
checks={}
for filename, schema in required.items():
    path=os.path.join(evidence_dir, filename)
    item={"schema":schema,"status":"MISSING","path":path}
    try:
        with open(path, encoding="utf-8") as f:
            data=json.load(f)
        item["status"]=data.get("status")
        item["checked_at_epoch"]=data.get("checked_at_epoch")
        item["evidence_source"]=data.get("evidence_source")
        if data.get("schema") != schema:
            failures.append(f"{filename}: schema mismatch")
        if data.get("status") != "PASS":
            failures.append(f"{filename}: status is not PASS")
        ts=data.get("checked_at_epoch")
        if not isinstance(ts, int):
            failures.append(f"{filename}: invalid checked_at_epoch")
        elif ts > now:
            failures.append(f"{filename}: timestamp is in the future")
        elif now-ts > max_age:
            failures.append(f"{filename}: evidence is stale")
        source=data.get("evidence_source")
        if not source or source in {"inferred","topology","ci-only","repository-only"}:
            failures.append(f"{filename}: evidence source is not physical/operator evidence")
    except Exception as exc:
        failures.append(f"{filename}: {exc}")
    checks[filename]=item

status="PRODUCTION_GATES_PASS" if not failures else "NOT_READY"
promotion_allowed=status=="PRODUCTION_GATES_PASS"
report={
    "schema":"izakhono.connecta.gate.production-promotion.v1",
    "status":status,
    "promotion_allowed":promotion_allowed,
    "public_cutover_performed":False,
    "checked_at_epoch":now,
    "max_age_seconds":max_age,
    "evidence_source":"operator_controlled_production_gate",
    "checks":checks,
    "failures":failures,
    "next_action":"Proceed to controlled public promotion only after an independent operator verifies the final DNS/TLS/routing change." if promotion_allowed else "Supply fresh passing physical/runtime evidence for every required gate.",
}
os.makedirs(os.path.dirname(report_path) or ".", exist_ok=True)
with open(report_path,"w",encoding="utf-8") as f:
    json.dump(report,f,indent=2)
    f.write("\n")
print(json.dumps(report,indent=2))
if not promotion_allowed:
    raise SystemExit(2)
PY
