#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST_DIR="${ROOT}/manifests"
STATE_ROOT="${IZAKHONO_PROVISIONER_STATE:-${ROOT}/state}"

usage() {
  echo "Usage: $0 plan <manifest.json> | register <manifest.json> | provision <manifest.json>"
}

require_manifest() {
  local file="$1"
  [[ -f "$file" ]] || { echo "[FAIL] Manifest not found: $file" >&2; exit 2; }
  command -v jq >/dev/null 2>&1 || { echo "[FAIL] jq is required" >&2; exit 2; }
}

load_manifest() {
  local file="$1"
  require_manifest "$file"
  SLUG="$(jq -r '.slug' "$file")"
  NAME="$(jq -r '.name' "$file")"
  SOURCE="$(jq -r '.source.path' "$file")"
  BRANCH="$(jq -r '.source.branch' "$file")"
  PORT="$(jq -r '.runtime.container_port' "$file")"
  HEALTH="$(jq -r '.runtime.health_path' "$file")"
  TARGET="$(jq -r '.production.target' "$file")"
  POLICY="$(jq -r '.production.policy' "$file")"
  LIVE="$(jq -r '.production.live' "$file")"
  ARTIFACT="$(jq -r '.rollback.artifact_identity' "$file")"
}

plan() {
  local file="$1"
  load_manifest "$file"
  cat <<EOF
{
  "schema":"izakhono.provision-plan/v1",
  "slug":"${SLUG}",
  "name":"${NAME}",
  "source":{"path":"${SOURCE}","branch":"${BRANCH}"},
  "runtime":{"port":${PORT},"health":"${HEALTH}","network":"izakhono_private","user":"node"},
  "target":"${TARGET}",
  "policy":"${POLICY}",
  "live":false,
  "artifact_identity":"${ARTIFACT}",
  "next_gate":"register"
}
EOF
}

register() {
  local file="$1"
  load_manifest "$file"
  mkdir -p "${STATE_ROOT}/registry"
  local out="${STATE_ROOT}/registry/${SLUG}.json"
  local tmp="${out}.tmp"
  jq -n \
    --arg slug "$SLUG" \
    --arg name "$NAME" \
    --arg source "$SOURCE" \
    --arg branch "$BRANCH" \
    --arg target "$TARGET" \
    '{schema:"izakhono.registry/v1",slug:$slug,name:$name,source:{path:$source,branch:$branch},target:$target,status:"REGISTERED",live:false}' > "$tmp"
  mv -f "$tmp" "$out"
  cat "$out"
}

provision() {
  local file="$1"
  load_manifest "$file"
  [[ "$POLICY" == "owned-first-externally-reversible" ]] || { echo "[FAIL] Unsupported production policy" >&2; exit 3; }
  [[ "$LIVE" == "false" ]] || { echo "[FAIL] Provisioner cannot provision a manifest marked live" >&2; exit 3; }
  mkdir -p "${STATE_ROOT}/provisioning"
  local out="${STATE_ROOT}/provisioning/${SLUG}.json"
  local tmp="${out}.tmp"
  jq -n \
    --arg slug "$SLUG" \
    --arg target "$TARGET" \
    '{schema:"izakhono.provision/v1",slug:$slug,target:$target,status:"PROVISION_READY",deployment_authority:"owned-runtime",live:false,next_gate:"deploy"}' > "$tmp"
  mv -f "$tmp" "$out"
  cat "$out"
}

[[ $# -eq 2 ]] || { usage; exit 2; }
case "$1" in
  plan) plan "$2" ;;
  register) register "$2" ;;
  provision) provision "$2" ;;
  *) usage; exit 2 ;;
esac
