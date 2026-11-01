#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_ROOT="${IZAKHONO_PROVISIONER_STATE:-${ROOT}/state}"

usage() {
  echo "Usage: $0 deploy <provision-state.json> | health <provision-state.json> | accept <provision-state.json>"
}

require_state() {
  local file="$1"
  [[ -f "$file" ]] || { echo "[FAIL] Provision state not found: $file" >&2; exit 2; }
  command -v jq >/dev/null 2>&1 || { echo "[FAIL] jq is required" >&2; exit 2; }
  jq -e '.schema == "izakhono.provision/v1" and .deployment_authority == "owned-runtime" and .live == false' "$file" >/dev/null || {
    echo "[FAIL] Invalid or unsafe provision state" >&2; exit 3;
  }
}

deploy() {
  local file="$1" slug target out tmp
  require_state "$file"
  slug="$(jq -r '.slug' "$file")"
  target="$(jq -r '.target' "$file")"
  [[ "$target" =~ ^NODE0[1-4]$ ]] || { echo "[FAIL] Invalid runtime target" >&2; exit 3; }
  mkdir -p "${STATE_ROOT}/deployments"
  out="${STATE_ROOT}/deployments/${slug}.json"
  tmp="${out}.tmp"
  jq -n --arg slug "$slug" --arg target "$target" \
    '{schema:"izakhono.deploy/v1",slug:$slug,target:$target,status:"DEPLOY_READY",live:false,next_gate:"health"}' > "$tmp"
  mv -f "$tmp" "$out"
  cat "$out"
}

health() {
  local file="$1" slug target out tmp
  require_state "$file"
  slug="$(jq -r '.slug' "$file")"
  target="$(jq -r '.target' "$file")"
  [[ "${IZAKHONO_HEALTH_VERIFIED:-false}" == "true" ]] || {
    echo "[FAIL] Independent runtime health evidence is required; set IZAKHONO_HEALTH_VERIFIED=true only after the owned runtime has been checked" >&2
    exit 4
  }
  mkdir -p "${STATE_ROOT}/health"
  out="${STATE_ROOT}/health/${slug}.json"
  tmp="${out}.tmp"
  jq -n --arg slug "$slug" --arg target "$target" \
    '{schema:"izakhono.health/v1",slug:$slug,target:$target,status:"HEALTH_VERIFIED",live:false,next_gate:"https"}' > "$tmp"
  mv -f "$tmp" "$out"
  cat "$out"
}

accept() {
  local file="$1" slug target out tmp
  require_state "$file"
  slug="$(jq -r '.slug' "$file")"
  target="$(jq -r '.target' "$file")"
  [[ "${IZAKHONO_ACCEPTANCE_VERIFIED:-false}" == "true" ]] || {
    echo "[FAIL] Independent acceptance evidence is required; set IZAKHONO_ACCEPTANCE_VERIFIED=true only after deployment, health and HTTPS checks pass" >&2
    exit 5
  }
  mkdir -p "${STATE_ROOT}/acceptance"
  out="${STATE_ROOT}/acceptance/${slug}.json"
  tmp="${out}.tmp"
  jq -n --arg slug "$slug" --arg target "$target" \
    '{schema:"izakhono.acceptance/v1",slug:$slug,target:$target,status:"ACCEPTED",live:false,next_gate:"promote"}' > "$tmp"
  mv -f "$tmp" "$out"
  cat "$out"
}

[[ $# -eq 2 ]] || { usage; exit 2; }
case "$1" in
  deploy) deploy "$2" ;;
  health) health "$2" ;;
  accept) accept "$2" ;;
  *) usage; exit 2 ;;
esac
