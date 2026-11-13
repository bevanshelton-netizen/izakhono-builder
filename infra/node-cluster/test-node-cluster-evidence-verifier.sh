#!/usr/bin/env bash
set -euo pipefail

# Synthetic fixtures exercise verifier behavior only. They are never uploaded,
# retained as certification artifacts, or used for production promotion.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || printf '.')"
cd "$ROOT"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fixture="$tmp/valid-fixture.json"

python3 - "$fixture" <<'PY'
import json, sys
from datetime import datetime, timezone
stamp = datetime.now(timezone.utc).isoformat()
names = ["NODE01", "NODE02", "NODE03", "NODE04"]
nodes = [{
    "node": name,
    "identityType": "software-runtime",
    "physicalHostIsSeparate": True,
    "status": "PASS",
    "runtime_evidence": True,
    "checkedAt": stamp
} for name in names]
record = {
    "schema": "izakhono.node-cluster-health.v1",
    "cluster": "izakhono-production",
    "nodeIdentityType": "software-runtime",
    "physicalHostIsSeparate": True,
    "checkedAt": stamp,
    "nodes": nodes,
    "healthyNodes": names,
    "requiredHealthyNodes": 4,
    "status": "PASS",
    "runtimeEvidence": True,
    "source": "operator-supplied-runtime-endpoints"
}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(record, f)
PY

bash infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh "$fixture"

python3 - "$fixture" <<'PY'
import json, sys
p=sys.argv[1]
d=json.load(open(p, encoding="utf-8"))
d["nodes"][2]["runtime_evidence"] = False
json.dump(d, open(p, "w", encoding="utf-8"))
PY
set +e
bash infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh "$fixture"
code=$?
set -e
if [[ "$code" -ne 10 ]]; then
  echo "[FAIL] verifier accepted a node without runtime evidence (exit $code)" >&2
  exit 1
fi

python3 - "$fixture" <<'PY'
import json, sys
from datetime import datetime, timezone, timedelta
p=sys.argv[1]
d=json.load(open(p, encoding="utf-8"))
old=(datetime.now(timezone.utc)-timedelta(minutes=10)).isoformat()
d["checkedAt"]=old
for n in d["nodes"]:
    n["checkedAt"]=old
json.dump(d, open(p, "w", encoding="utf-8"))
PY
set +e
bash infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh "$fixture"
code=$?
set -e
if [[ "$code" -ne 10 ]]; then
  echo "[FAIL] verifier accepted stale runtime evidence (exit $code)" >&2
  exit 1
fi

echo "[PASS] verifier accepts a valid-shaped fixture and rejects failed-node and stale evidence."
