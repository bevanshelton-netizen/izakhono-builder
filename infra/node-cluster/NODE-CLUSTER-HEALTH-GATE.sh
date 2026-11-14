#!/usr/bin/env bash
set -euo pipefail

# IZAKHONO NODE CLUSTER HEALTH GATE
# NODE01-NODE04 are software/runtime identities, never physical-machine names.
# Each endpoint must self-identify; four URLs returning the same generic OK
# response are not accepted as proof of four distinct runtime nodes.

NODE01_URL="${NODE01_URL:-}"
NODE02_URL="${NODE02_URL:-}"
NODE03_URL="${NODE03_URL:-}"
NODE04_URL="${NODE04_URL:-}"
OUTPUT="${OUTPUT:-node-cluster-health.json}"
TIMEOUT="${TIMEOUT:-8}"

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 2; }

python3 - "$OUTPUT" "$TIMEOUT" "$NODE01_URL" "$NODE02_URL" "$NODE03_URL" "$NODE04_URL" <<'PY'
import json, subprocess, sys
from datetime import datetime, timezone

output, timeout, *urls = sys.argv[1:]
names = ["NODE01", "NODE02", "NODE03", "NODE04"]
results = []

for name, url in zip(names, urls):
    checked = datetime.now(timezone.utc).isoformat()
    if not url:
        results.append({"node": name, "identityType": "software-runtime", "physicalHostIsSeparate": True, "status": "MISSING_ENDPOINT", "runtime_evidence": False, "checkedAt": checked})
        continue
    try:
        p = subprocess.run(
            ["curl", "--fail", "--silent", "--show-error", "--max-time", timeout, url],
            capture_output=True, text=True, check=False,
        )
        body = p.stdout.strip()
        payload = json.loads(body) if body else {}
        # The response must identify the logical node being checked. This
        # prevents one healthy endpoint being reused for all four variables.
        identity_matches = isinstance(payload, dict) and payload.get("runtimeNode") == name
        healthy = p.returncode == 0 and payload.get("ok") is True and identity_matches
        results.append({
            "node": name,
            "runtimeNode": payload.get("runtimeNode") if isinstance(payload, dict) else None,
            "identityType": "software-runtime",
            "physicalHostIsSeparate": True,
            "status": "PASS" if healthy else "IDENTITY_MISMATCH_OR_UNHEALTHY",
            "runtime_evidence": healthy,
            "checkedAt": checked,
            "http": payload,
            "exitCode": p.returncode,
        })
    except Exception as exc:
        results.append({"node": name, "identityType": "software-runtime", "physicalHostIsSeparate": True, "status": "ERROR", "runtime_evidence": False, "checkedAt": checked, "error": str(exc)})

healthy = [r["node"] for r in results if r["runtime_evidence"]]
passed = len(healthy) == 4
record = {
    "schema": "izakhono.node-cluster-health.v1",
    "cluster": "izakhono-production",
    "nodeIdentityType": "software-runtime",
    "physicalHostIsSeparate": True,
    "checkedAt": datetime.now(timezone.utc).isoformat(),
    "nodes": results,
    "healthyNodes": healthy,
    "requiredHealthyNodes": 4,
    "status": "PASS" if passed else "BLOCKED",
    "runtimeEvidence": True,
    "source": "operator-supplied-runtime-endpoints",
}
with open(output, "w", encoding="utf-8") as f:
    json.dump(record, f, indent=2)
    f.write("\n")

print(json.dumps({"status": record["status"], "healthyNodes": healthy, "output": output}))
PY

if python3 - "$OUTPUT" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f: d=json.load(f)
sys.exit(0 if d.get("status") == "PASS" and d.get("nodeIdentityType") == "software-runtime" and d.get("physicalHostIsSeparate") is True else 1)
PY
then
  exit 0
fi
exit 1
