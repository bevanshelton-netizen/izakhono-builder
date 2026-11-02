#!/usr/bin/env bash
set -euo pipefail

# Host-side gate for an approved IZAKHONO runtime host.
# NODE01-NODE04 are logical software/runtime identities; the host is separate.
# This script verifies prerequisites and writes evidence only. It never declares LIVE.

NODE_ID="${IZAKHONO_NODE_ID:-NODE01}"
RUNTIME_HOST="${IZAKHONO_RUNTIME_HOST_NAME:-$(hostname -s)}"
STATE_ROOT="${IZAKHONO_STATE_ROOT:-/opt/izakhono}"
EDGE_NETWORK="${IZAKHONO_EDGE_NETWORK:-izakhono-edge}"
RELEASE_ADAPTER="${IZAKHONO_RELEASE_ADAPTER:-${STATE_ROOT}/bin/izakhono-release}"
EVIDENCE_DIR="${IZAKHONO_EVIDENCE_DIR:-${STATE_ROOT}/state/runtime-host}"

fail=0
fail_check() { printf 'FAIL  %s\n' "$1"; fail=1; }
pass_check() { printf 'PASS  %s\n' "$1"; }

case "$NODE_ID" in
  NODE01|NODE02|NODE03|NODE04) ;;
  *) fail_check "logical node identity is valid"; echo "Invalid IZAKHONO_NODE_ID=$NODE_ID" >&2 ;;
esac

if [[ "$(id -u)" -eq 0 ]]; then pass_check "root"; else fail_check "root"; fi
command -v docker >/dev/null 2>&1 && pass_check "docker" || fail_check "docker"
docker info >/dev/null 2>&1 && pass_check "docker operational" || fail_check "docker operational"
docker compose version >/dev/null 2>&1 && pass_check "docker compose" || fail_check "docker compose"
[[ -d "$STATE_ROOT" ]] && pass_check "state root $STATE_ROOT" || fail_check "state root $STATE_ROOT"
docker network inspect "$EDGE_NETWORK" >/dev/null 2>&1 && pass_check "edge network $EDGE_NETWORK" || fail_check "edge network $EDGE_NETWORK"
[[ -x "$RELEASE_ADAPTER" ]] && pass_check "release adapter" || fail_check "release adapter"

for port in 80 443; do
  if command -v ss >/dev/null 2>&1 && ss -ltn "sport = :$port" | tail -n +2 | grep -q .; then
    pass_check "TCP $port listener"
  else
    printf 'WARN  TCP %s listener not detected (edge may be provisioned after preflight)\n' "$port"
  fi
done

mkdir -p "$EVIDENCE_DIR"
chmod 750 "$EVIDENCE_DIR"
EVIDENCE="$EVIDENCE_DIR/preflight.json"
TMP="$EVIDENCE.tmp"

if [[ "$fail" -eq 0 ]]; then STATUS="READY_FOR_RUNTIME_DEPLOYMENT"; else STATUS="BLOCKED"; fi
cat >"$TMP" <<JSON
{
  "schema": "izakhono.runtime-host-evidence/v1",
  "nodeId": "$NODE_ID",
  "identityType": "software-runtime",
  "runtimeHost": "$RUNTIME_HOST",
  "runtimeHostIsSeparate": true,
  "stateRoot": "$STATE_ROOT",
  "edgeNetwork": "$EDGE_NETWORK",
  "releaseAdapter": "$RELEASE_ADAPTER",
  "preflightStatus": "$STATUS",
  "healthVerified": false,
  "httpsVerified": false,
  "acceptanceVerified": false,
  "live": false
}
JSON
mv -f "$TMP" "$EVIDENCE"
chmod 640 "$EVIDENCE"

cat "$EVIDENCE"
[[ "$fail" -eq 0 ]] || exit 2
printf 'Runtime host preflight PASSED for logical identity %s on host %s. No LIVE claim.\n' "$NODE_ID" "$RUNTIME_HOST"
