#!/usr/bin/env bash
set -euo pipefail

# Exercises the authenticated health-gate protocol with a local fake curl.
# These fixtures are never production evidence and no external runtime is contacted.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin"

cat > "$tmp/bin/curl" <<'PY'
#!/usr/bin/env python3
import hashlib
import hmac
import json
import sys

args = sys.argv[1:]
headers = {}
url = args[-1]
output = None
for index, value in enumerate(args[:-1]):
    if value == "--header" and index + 1 < len(args):
        key, _, val = args[index + 1].partition(":")
        headers[key.strip().lower()] = val.strip()
    if value == "--output" and index + 1 < len(args):
        output = args[index + 1]

nodes = {
    "https://node01.example.test/health/cluster": ("NODE01", "a" * 64, 200),
    "https://node02.example.test/health/cluster": ("NODE02", "b" * 64, 200),
    "https://node03.example.test/health/cluster": ("NODE03", "c" * 64, 200),
    "https://node04.example.test/health/cluster": ("NODE04", "d" * 64, 200),
    "https://node04-bad-signature.example.test/health/cluster": ("NODE04", "d" * 64, 200),
    "https://node04-redirect.example.test/health/cluster": ("NODE04", "d" * 64, 302),
}
node = nodes.get(url)
if node is None or output is None:
    raise SystemExit(22)
name, token, status = node
if headers.get("authorization") != f"Bearer {token}":
    raise SystemExit(22)
nonce = headers.get("x-izakhono-probe-nonce", "")
signature = hmac.new(
    bytes.fromhex(token),
    f"izakhono-production\n{name}\n{nonce}".encode(),
    hashlib.sha256,
).hexdigest()
if "bad-signature" in url:
    signature = "0" * 64
body = json.dumps({
    "ok": True,
    "cluster": "izakhono-production",
    "runtimeNode": name,
    "authScheme": "bearer-hmac-sha256",
    "probeNonce": nonce,
    "probeSignature": signature,
})
with open(output, "w", encoding="utf-8") as stream:
    stream.write(body)
print(status)
PY
chmod +x "$tmp/bin/curl"

COMMON_ENV=(
  "PATH=$tmp/bin:$PATH"
  "NODE01_URL=https://node01.example.test/health/cluster"
  "NODE02_URL=https://node02.example.test/health/cluster"
  "NODE03_URL=https://node03.example.test/health/cluster"
  "NODE04_URL=https://node04.example.test/health/cluster"
  "NODE01_HEALTH_TOKEN=$(printf 'a%.0s' {1..64})"
  "NODE02_HEALTH_TOKEN=$(printf 'b%.0s' {1..64})"
  "NODE03_HEALTH_TOKEN=$(printf 'c%.0s' {1..64})"
  "NODE04_HEALTH_TOKEN=$(printf 'd%.0s' {1..64})"
  "TIMEOUT=5"
)

# Four distinct URLs, credentials and signed challenges must pass.
env "${COMMON_ENV[@]}" OUTPUT="$tmp/valid.json" /usr/bin/bash "$ROOT/infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh"
bash "$ROOT/infra/node-cluster/VERIFY-NODE-CLUSTER-EVIDENCE.sh" "$tmp/valid.json"
python3 - "$tmp/valid.json" <<'PY'
import json, sys
d=json.load(open(sys.argv[1], encoding="utf-8"))
assert d["status"] == "PASS"
assert d["authentication"] == {"scheme":"bearer-hmac-sha256","perNodeCredentials":True}
assert len(d["healthyNodes"]) == 4
assert all(n["authentication"]["challengeVerified"] for n in d["nodes"])
assert all(n["http"]["status"] == 200 for n in d["nodes"])
PY

expect_blocked() {
  local label="$1" code
  shift
  set +e
  "$@" >/dev/null 2>&1
  code=$?
  set -e
  if [[ "$code" -ne 1 ]]; then
    echo "[FAIL] expected health gate to block $label (exit $code)" >&2
    exit 1
  fi
}

# Reusing one URL for four node names must fail before any curl request.
expect_blocked "duplicate endpoint" env "${COMMON_ENV[@]}" \
  NODE02_URL=https://node01.example.test/health/cluster OUTPUT="$tmp/duplicate-url.json" \
  /usr/bin/bash "$ROOT/infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh"

# Reusing a credential across node identities must be rejected.
expect_blocked "duplicate credential" env "${COMMON_ENV[@]}" \
  NODE04_HEALTH_TOKEN="$(printf 'c%.0s' {1..64})" OUTPUT="$tmp/duplicate-token.json" \
  /usr/bin/bash "$ROOT/infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh"

# A response with a bad HMAC must not certify the node.
expect_blocked "invalid HMAC challenge" env "${COMMON_ENV[@]}" \
  NODE04_URL=https://node04-bad-signature.example.test/health/cluster OUTPUT="$tmp/bad-signature.json" \
  /usr/bin/bash "$ROOT/infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh"

# A valid-looking signed body on a redirect/non-200 response must not pass.
expect_blocked "HTTP redirect" env "${COMMON_ENV[@]}" \
  NODE04_URL=https://node04-redirect.example.test/health/cluster OUTPUT="$tmp/redirect.json" \
  /usr/bin/bash "$ROOT/infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh"

# Credentials embedded in an endpoint URL are rejected before probing.
expect_blocked "URL-embedded credentials" env "${COMMON_ENV[@]}" \
  NODE04_URL=https://secret@node04.example.test/health/cluster OUTPUT="$tmp/url-credentials.json" \
  /usr/bin/bash "$ROOT/infra/node-cluster/NODE-CLUSTER-HEALTH-GATE.sh"

echo "[PASS] health gate requires HTTP 200, unique HTTPS endpoints, unique per-node credentials and fresh HMAC challenges."
