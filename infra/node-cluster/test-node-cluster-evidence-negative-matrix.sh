#!/usr/bin/env bash
set -euo pipefail

# Negative security matrix for the four-node evidence verifier.
# All generated records are synthetic test fixtures, never production proof.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fixture="$tmp/evidence.json"

python3 - "$fixture" <<'PY'
import json, sys
from datetime import datetime, timezone
stamp = datetime.now(timezone.utc).isoformat()
names = ["NODE01", "NODE02", "NODE03", "NODE04"]
nodes = [{
    "node": n, "runtimeNode": n, "identityType": "software-runtime",
    "physicalHostIsSeparate": True, "status": "PASS", "runtime_evidence": True,
    "checkedAt": stamp,
    "http": {"ok": True, "runtimeNode": n, "cluster": "izakhono-production"}
} for n in names]
data = {
    "schema": "izakhono.node-cluster-health.v1",
    "cluster": "izakhono-production",
    "nodeIdentityType": "software-runtime",
    "physicalHostIsSeparate": True,
    "checkedAt": stamp,
    "nodes": nodes, "healthyNodes": names,
    "requiredHealthyNodes": 4, "status": "PASS",
    "runtimeEvidence": True,
    "source": "operator-supplied-runtime-endpoints"
}
json.dump(data, open(sys.argv[1], "w", encoding="utf-8"))
PY

expect_blocked() {
  local label="$1" code
  set +e
  bash infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh "$fixture" >/dev/null 2>&1
  code=$?
  set -e
  if [[ "$code" -ne 10 ]]; then
    echo "[FAIL] verifier did not fail closed for: $label (exit $code)" >&2
    exit 1
  fi
}

mutate() {
  python3 - "$fixture" "$1" <<'PY'
import json, sys
p, case = sys.argv[1:]
d = json.load(open(p, encoding="utf-8"))
if case == "runtimeEvidence": d["runtimeEvidence"] = False
elif case == "status": d["status"] = "BLOCKED"
elif case == "source": d["source"] = "simulated-runtime"
elif case == "missing-node": d["nodes"] = d["nodes"][:3]
elif case == "duplicate-node": d["nodes"][3]["node"] = "NODE03"
elif case == "missing-healthy-node": d["healthyNodes"] = d["healthyNodes"][:3]
elif case == "wrong-cluster": d["cluster"] = "untrusted-cluster"
elif case == "physical-identity": d["nodeIdentityType"] = "physical-workstation"
elif case == "missing-timestamp": d.pop("checkedAt", None)
json.dump(d, open(p, "w", encoding="utf-8"))
PY
}

for case in runtimeEvidence status source missing-node duplicate-node missing-healthy-node wrong-cluster physical-identity missing-timestamp; do
  mutate "$case"
  expect_blocked "$case"
  # Restore the known-good fixture before testing the next independent mutation.
  python3 - "$fixture" <<'PY'
import json, sys
from datetime import datetime, timezone
p=sys.argv[1]
stamp=datetime.now(timezone.utc).isoformat()
names=["NODE01","NODE02","NODE03","NODE04"]
nodes=[{"node":n,"runtimeNode":n,"identityType":"software-runtime","physicalHostIsSeparate":True,"status":"PASS","runtime_evidence":True,"checkedAt":stamp,"http":{"ok":True,"runtimeNode":n,"cluster":"izakhono-production"}} for n in names]
d={"schema":"izakhono.node-cluster-health.v1","cluster":"izakhono-production","nodeIdentityType":"software-runtime","physicalHostIsSeparate":True,"checkedAt":stamp,"nodes":nodes,"healthyNodes":names,"requiredHealthyNodes":4,"status":"PASS","runtimeEvidence":True,"source":"operator-supplied-runtime-endpoints"}
json.dump(d,open(p,"w",encoding="utf-8"))
PY
done

echo "[PASS] verifier rejects nine independent malformed, incomplete, stale-trust or non-runtime evidence cases."
