#!/usr/bin/env bash
set -euo pipefail

# Owner-run runtime activation orchestrator.
# NODE01-NODE04 are logical software/runtime identities; the runtime host is separate.
# This script never manufactures evidence and never declares LIVE.

NODE_ID="${IZAKHONO_NODE_ID:-NODE01}"
STATE_ROOT="${IZAKHONO_STATE_ROOT:-/opt/izakhono}"
PRECHECK="${IZAKHONO_PRECHECK:-${STATE_ROOT}/bin/host-preflight.sh}"
RELEASE_ADAPTER="${IZAKHONO_RELEASE_ADAPTER:-${STATE_ROOT}/bin/izakhono-release}"
ARTIFACT_FILE="${IZAKHONO_ARTIFACT_FILE:-}"

fail() { echo "ACTIVATION BLOCKED: $*" >&2; exit 2; }
case "$NODE_ID" in NODE01|NODE02|NODE03|NODE04) ;; *) fail "invalid logical node identity: $NODE_ID" ;; esac
[[ "$(id -u)" -eq 0 ]] || fail "run as root on the approved runtime host"
[[ -x "$PRECHECK" ]] || fail "missing host preflight: $PRECHECK"
[[ -x "$RELEASE_ADAPTER" ]] || fail "missing release adapter: $RELEASE_ADAPTER"
mkdir -p "$STATE_ROOT/state/activation"
"$PRECHECK"
[[ -n "$ARTIFACT_FILE" ]] || fail "set IZAKHONO_ARTIFACT_FILE to the exact immutable release descriptor"
[[ -f "$ARTIFACT_FILE" ]] || fail "artifact descriptor not found: $ARTIFACT_FILE"
"$RELEASE_ADAPTER" apply "$ARTIFACT_FILE"
echo "Runtime deployment gate completed for logical identity $NODE_ID."
echo "Next gates: health -> HTTPS -> acceptance -> backup/restore -> promotion."
echo "LIVE remains false until independent runtime evidence satisfies every gate."
