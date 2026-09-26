#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-./fabric.env}"
[[ -f "$ENV_FILE" ]] || { echo "Missing $ENV_FILE"; exit 2; }

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

HEALTH_PATH="${IZAKHONO_HEALTH_PATH:-/health}"
TIMEOUT="${IZAKHONO_HEALTH_TIMEOUT_SECONDS:-5}"
healthy=0
checked=0

check_target() {
  local name="$1"
  local base="$2"
  [[ -n "$base" ]] || return 0
  checked=$((checked+1))
  local url="${base%/}$HEALTH_PATH"
  printf '%-24s ' "$name"
  if curl -fsS --max-time "$TIMEOUT" "$url" >/dev/null; then
    echo "HEALTHY  $url"
    healthy=$((healthy+1))
  else
    echo "UNHEALTHY $url"
  fi
}

check_target "${IZAKHONO_TARGET_1_NAME:-NODE01}" "${IZAKHONO_TARGET_1_URL:-}"
check_target "${IZAKHONO_TARGET_2_NAME:-NODE02}" "${IZAKHONO_TARGET_2_URL:-}"
check_target "${IZAKHONO_TARGET_3_NAME:-NODE03}" "${IZAKHONO_TARGET_3_URL:-}"
check_target "${IZAKHONO_TARGET_4_NAME:-NODE04}" "${IZAKHONO_TARGET_4_URL:-}"
check_target "${IZAKHONO_EXTERNAL_NAME:-EXTERNAL-RESILIENCE}" "${IZAKHONO_EXTERNAL_URL:-}"

echo
echo "Healthy targets: $healthy / $checked"

if [[ "$checked" -eq 0 ]]; then
  echo "No runtime targets configured."
  exit 3
fi

if [[ "$healthy" -lt 1 ]]; then
  echo "No healthy runtime is available."
  exit 4
fi

echo "Runtime Fabric has at least one serving target."
