#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
DIGEST="sha256:$(printf 'a%.0s' {1..64})"
CONNECTA_ENGINE_IMAGE="ghcr.io/bevanshelton-netizen/connecta-engine:0.3.0@$DIGEST" \
  bash "$ROOT/infra/node-cluster/RENDER-CONNECTA-RUNTIME-RELEASE.sh" "$TMP/release"
python3 - "$TMP/release" "$DIGEST" <<'PY'
import hashlib, json, pathlib, sys
root = pathlib.Path(sys.argv[1])
digest = sys.argv[2]
manifest = root / "connecta-runtime.yaml"
release = json.loads((root / "release.json").read_text())
text = manifest.read_text()
expected = "ghcr.io/bevanshelton-netizen/connecta-engine:0.3.0@" + digest
assert text.count(expected) == 4, "all four deployments must use the built digest"
assert release["image"] == expected
assert release["manifestSha256"] == hashlib.sha256(manifest.read_bytes()).hexdigest()
assert release["deploymentAuthorized"] is False
assert release["runtimeLiveVerified"] is False
print("[PASS] runtime bundle pins all four logical nodes to the exact built image digest.")
PY

# Invalid and mutable references must fail closed.
set +e
CONNECTA_ENGINE_IMAGE="ghcr.io/bevanshelton-netizen/connecta-engine:0.3.0" \
  bash "$ROOT/infra/node-cluster/RENDER-CONNECTA-RUNTIME-RELEASE.sh" "$TMP/invalid" >/dev/null 2>&1
code=$?
set -e
[[ "$code" -eq 10 ]] || { echo "[FAIL] mutable image reference was not blocked (exit $code)" >&2; exit 1; }
echo "[PASS] runtime release renderer rejects mutable image references."
