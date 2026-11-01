#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_ROOT="${IZAKHONO_PROVISIONER_STATE:-${ROOT}/state}"

usage() { echo "Usage: $0 verify <provision-state.json> <evidence.json>"; }

[[ $# -eq 3 && "$1" == "verify" ]] || { usage; exit 2; }
PROVISION="$2"
EVIDENCE="$3"
command -v jq >/dev/null 2>&1 || { echo "[FAIL] jq is required" >&2; exit 2; }
[[ -f "$PROVISION" && -f "$EVIDENCE" ]] || { echo "[FAIL] provision state and evidence are required" >&2; exit 2; }

jq -e '.schema == "izakhono.provision/v1" and .deployment_authority == "owned-runtime" and .live == false' "$PROVISION" >/dev/null
SLUG="$(jq -r '.slug' "$PROVISION")"
TARGET="$(jq -r '.target' "$PROVISION")"

jq -e --arg slug "$SLUG" --arg target "$TARGET" '
  .schema == "izakhono.runtime-evidence/v1" and
  .slug == $slug and
  .target == $target and
  .node_identity_type == "software-runtime" and
  .physical_host_is_separate == true and
  .owned_runtime == true and
  .docker_verified == true and
  .edge_network_verified == true and
  .artifact_digest_verified == true and
  .health_verified == true and
  .https_verified == true and
  .acceptance_verified == true and
  .live == false
' "$EVIDENCE" >/dev/null || { echo "[FAIL] runtime evidence is incomplete or unsafe" >&2; exit 4; }

mkdir -p "${STATE_ROOT}/evidence"
out="${STATE_ROOT}/evidence/${SLUG}.json"
tmp="${out}.tmp"
cp "$EVIDENCE" "$tmp"
mv -f "$tmp" "$out"
cat "$out"
echo "[PASS] Owned-runtime deployment evidence verified; promotion remains a separate gate."
