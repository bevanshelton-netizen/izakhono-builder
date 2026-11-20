#!/usr/bin/env bash
set -euo pipefail

# Render a deployment bundle from the exact digest emitted by build-push-action.
# This script does not deploy or claim that any runtime is live.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE="${CONNECTA_ENGINE_IMAGE:-}"
OUTPUT_DIR="${1:-$ROOT/dist/connecta-runtime-release}"
TEMPLATE="$ROOT/infra/node-cluster/connecta-runtime.yaml"
PLACEHOLDER='ghcr.io/bevanshelton-netizen/connecta-engine:0.3.0@sha256:838b095cd2b12a9f66526e5086501474f6958e20f597efa96875217390b580da'

if [[ ! "$IMAGE" =~ ^ghcr\.io/bevanshelton-netizen/connecta-engine:0\.3\.0@sha256:[a-f0-9]{64}$ ]]; then
  echo "[BLOCKED] CONNECTA_ENGINE_IMAGE must be the immutable digest output from the CONNECTA image build." >&2
  exit 10
fi
[[ -f "$TEMPLATE" ]] || { echo "[BLOCKED] runtime manifest template missing" >&2; exit 10; }

mkdir -p "$OUTPUT_DIR"
python3 - "$TEMPLATE" "$OUTPUT_DIR/connecta-runtime.yaml" "$PLACEHOLDER" "$IMAGE" <<'PY'
import pathlib, sys
source, target, placeholder, image = map(str, sys.argv[1:])
text = pathlib.Path(source).read_text(encoding="utf-8")
count = text.count(placeholder)
if count != 4:
    raise SystemExit(f"[BLOCKED] expected four canonical image references, found {count}")
pathlib.Path(target).write_text(text.replace(placeholder, image), encoding="utf-8")
PY

CONNECTA_ENGINE_IMAGE="$IMAGE" bash "$ROOT/infra/node-cluster/validate-connecta-runtime-manifest.sh" "$OUTPUT_DIR/connecta-runtime.yaml"
IMAGE="$IMAGE" OUTPUT_DIR="$OUTPUT_DIR" python3 - <<'PY'
import hashlib, json, os, pathlib
image = os.environ["IMAGE"]
manifest = pathlib.Path(os.environ["OUTPUT_DIR"]) / "connecta-runtime.yaml"
payload = {
  "schema": "izakhono.connecta-runtime-release.v1",
  "product": "CONNECTA",
  "engineVersion": "0.3.0",
  "image": image,
  "manifest": manifest.name,
  "manifestSha256": hashlib.sha256(manifest.read_bytes()).hexdigest(),
  "deploymentAuthorized": False,
  "runtimeLiveVerified": False,
}
(manifest.parent / "release.json").write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
echo "[PASS] digest-matched CONNECTA runtime release bundle rendered: $OUTPUT_DIR"
