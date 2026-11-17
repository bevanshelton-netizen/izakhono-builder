#!/usr/bin/env bash
set -euo pipefail

# Negative security matrix for the four-node evidence verifier.
# All generated records are synthetic test fixtures, never production proof.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fixture="$tmp/evidence.json"

write_valid_fixture() {
python3 - "$fixture" <<'PY'
import hashlib, hmac, json, sys
from datetime import datetime, timezone
stamp = datetime.now(timezone.utc).isoformat()
names = ["NODE01", "NODE02", "NODE03", "NODE04"]
tokens = ["a"*64, "b"*64, "c"*64, "d"*64]
nonces = ["e"*64, "f"*64, "1"*64, "2"*64]
nodes = []
for name, token, nonce in zip(names, tokens, nonces):
    signature = hmac.new(bytes.fromhex(token), f"izakhono-production\n{name}\n{nonce}".encode(), hashlib.sha256).hexdigest()
    nodes.append({
        "node": name, "runtimeNode": name, "identityType": "software-runtime",
        "physicalHostIsSeparate": True, "status": "PASS", "runtime_evidence": True,
        "checkedAt": stamp,
        "authentication": {"scheme":"bearer-hmac-sha256","challengeVerified":True},
        "probeNonce": nonce, "probeSignature": signature,
        "http": {"ok": True, "runtimeNode": name, "cluster": "izakhono-production", "authScheme":"bearer-hmac-sha256"}
    })
data = {
    "schema": "izakhono.node-cluster-health.v1",
    "cluster": "izakhono-production",
    "nodeIdentityType": "software-runtime",
    "physicalHostIsSeparate": True,
    "authentication": {"scheme":"bearer-hmac-sha256","perNodeCredentials":True},
    "checkedAt": stamp,
    "nodes": nodes, "healthyNodes": names,
    "requiredHealthyNodes": 4, "status": "PASS",
    "runtimeEvidence": True,
    "source": "operator-supplied-authenticated-runtime-endpoints"
}
json.dump(data, open(sys.argv[1], "w", encoding="utf-8"))
PY
}

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
elif case == "missing-authentication": d.pop("authentication", None)
elif case == "challenge-failed": d["nodes"][0]["authentication"]["challengeVerified"] = False
elif case == "signature-malformed": d["nodes"][1]["probeSignature"] = "invalid"
elif case == "duplicate-nonce": d["nodes"][1]["probeNonce"] = d["nodes"][0]["probeNonce"]
elif case == "wrong-auth-scheme": d["nodes"][2]["http"]["authScheme"] = "bearer-only"
json.dump(d, open(p, "w", encoding="utf-8"))
PY
}

for case in runtimeEvidence status source missing-node duplicate-node missing-healthy-node wrong-cluster physical-identity missing-timestamp missing-authentication challenge-failed signature-malformed duplicate-nonce wrong-auth-scheme; do
  write_valid_fixture
  mutate "$case"
  expect_blocked "$case"
done

echo "[PASS] verifier rejects thirteen independent incomplete, stale-trust, non-runtime or unauthenticated evidence cases."
