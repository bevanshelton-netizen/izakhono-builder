#!/usr/bin/env bash
set -euo pipefail

# Synthetic fixtures test verifier behavior only. They are never production
# evidence and must never be uploaded or used for promotion.
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || printf '.')"
cd "$ROOT"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fixture="$tmp/valid-fixture.json"

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
        "http": {"status": 200, "ok": True, "runtimeNode": name, "cluster": "izakhono-production", "authScheme":"bearer-hmac-sha256"}
    })
record = {
    "schema": "izakhono.node-cluster-health.v1",
    "cluster": "izakhono-production",
    "nodeIdentityType": "software-runtime",
    "physicalHostIsSeparate": True,
    "authentication": {"scheme":"bearer-hmac-sha256","perNodeCredentials":True},
    "checkedAt": stamp,
    "nodes": nodes,
    "healthyNodes": names,
    "requiredHealthyNodes": 4,
    "status": "PASS",
    "runtimeEvidence": True,
    "source": "operator-supplied-authenticated-runtime-endpoints"
}
with open(sys.argv[1], "w", encoding="utf-8") as f:
    json.dump(record, f)
PY

bash infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh "$fixture"

# Production mode recomputes each HMAC with protected per-node credentials.
env CONNECTA_REQUIRE_CRYPTOGRAPHIC_EVIDENCE=true \
  NODE01_HEALTH_TOKEN="$(printf 'a%.0s' {1..64})" \
  NODE02_HEALTH_TOKEN="$(printf 'b%.0s' {1..64})" \
  NODE03_HEALTH_TOKEN="$(printf 'c%.0s' {1..64})" \
  NODE04_HEALTH_TOKEN="$(printf 'd%.0s' {1..64})" \
  bash infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh "$fixture"

# A syntactically valid but forged signature must fail cryptographic verification.
python3 - "$fixture" <<'PY'
import json, sys
p=sys.argv[1]
d=json.load(open(p, encoding="utf-8"))
d["nodes"][0]["probeSignature"]="0"*64
json.dump(d, open(p, "w", encoding="utf-8"))
PY
set +e
env CONNECTA_REQUIRE_CRYPTOGRAPHIC_EVIDENCE=true \
  NODE01_HEALTH_TOKEN="$(printf 'a%.0s' {1..64})" \
  NODE02_HEALTH_TOKEN="$(printf 'b%.0s' {1..64})" \
  NODE03_HEALTH_TOKEN="$(printf 'c%.0s' {1..64})" \
  NODE04_HEALTH_TOKEN="$(printf 'd%.0s' {1..64})" \
  bash infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh "$fixture"
crypto_code=$?
set -e
if [[ "$crypto_code" -ne 10 ]]; then
  echo "[FAIL] verifier accepted a forged HMAC signature (exit $crypto_code)" >&2
  exit 1
fi

# Reject an endpoint response that claims a different runtime identity.
python3 - "$fixture" <<'PY'
import json, sys
p=sys.argv[1]
d=json.load(open(p, encoding="utf-8"))
d["nodes"][2]["http"]["runtimeNode"]="NODE02"
json.dump(d, open(p, "w", encoding="utf-8"))
PY
set +e
bash infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh "$fixture"
code=$?
set -e
if [[ "$code" -ne 10 ]]; then
  echo "[FAIL] verifier accepted a mismatched runtime identity (exit $code)" >&2
  exit 1
fi

# Reject a node reporting the wrong cluster identity.
python3 - "$fixture" <<'PY'
import json, sys
p=sys.argv[1]
d=json.load(open(p, encoding="utf-8"))
d["nodes"][2]["http"]["runtimeNode"]="NODE03"
d["nodes"][2]["http"]["cluster"]="another-cluster"
json.dump(d, open(p, "w", encoding="utf-8"))
PY
set +e
bash infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh "$fixture"
code=$?
set -e
if [[ "$code" -ne 10 ]]; then
  echo "[FAIL] verifier accepted a mismatched cluster identity (exit $code)" >&2
  exit 1
fi

# Reject stale evidence.
python3 - "$fixture" <<'PY'
import json, sys
from datetime import datetime, timezone, timedelta
p=sys.argv[1]
d=json.load(open(p, encoding="utf-8"))
d["nodes"][2]["http"]["cluster"]="izakhono-production"
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

echo "[PASS] verifier accepts authenticated node challenges and rejects mismatched identity, cluster and stale evidence."
