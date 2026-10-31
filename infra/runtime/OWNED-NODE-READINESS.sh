#!/usr/bin/env bash
set -euo pipefail

STATE_ROOT="${IZAKHONO_STATE_ROOT:-/opt/izakhono}"
EDGE_NETWORK="${IZAKHONO_EDGE_NETWORK:-izakhono-edge}"
OUT="${IZAKHONO_READINESS_OUTPUT:-/tmp/izakhono-owned-node-readiness.json}"

failures=()
check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf '[PASS] %s\n' "$name"
  else
    printf '[FAIL] %s\n' "$name"
    failures+=("$name")
  fi
}

check 'Docker command' command -v docker
check 'Docker daemon' docker info
check 'jq command' command -v jq
check 'curl command' command -v curl
check 'Persistent state root' test -d "$STATE_ROOT"
check 'Release adapter installed' test -x "$STATE_ROOT/bin/izakhono-release"
check 'Edge network exists' docker network inspect "$EDGE_NETWORK"
check 'Owned runtime marker' test "${IZAKHONO_OWNED_RUNTIME:-}" = true

if ((${#failures[@]} == 0)); then
  status=true
else
  status=false
fi

jq -n \
  --arg schema 'izakhono.owned-node-readiness/v1' \
  --arg state_root "$STATE_ROOT" \
  --arg network "$EDGE_NETWORK" \
  --argjson ok "$status" \
  --argjson failures "$(printf '%s\n' "${failures[@]:-}" | jq -R -s 'split("\n") | map(select(length > 0))')" \
  '{schema:$schema,ok:$ok,state_root:$state_root,edge_network:$network,failures:$failures}' \
  > "$OUT"

cat "$OUT"

$([[ "$status" == true ]] && echo '[PASS] Owned node readiness gate passed.' || { echo '[FAIL] Owned node readiness gate failed.'; exit 1; })
