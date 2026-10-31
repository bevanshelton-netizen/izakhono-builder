#!/usr/bin/env bash
set -euo pipefail

# IZAKHONO owned-node bootstrap.
# This script prepares a Linux host for the owned production runtime.
# It never contains or persists a GitHub runner token. Supply the token only
# through the environment at registration time, or complete registration
# separately with an approved operator workflow.

STATE_ROOT="${IZAKHONO_STATE_ROOT:-/opt/izakhono}"
BIN_ROOT="${IZAKHONO_BIN_ROOT:-${STATE_ROOT}/bin}"
EDGE_NETWORK="${IZAKHONO_EDGE_NETWORK:-izakhono-edge}"
RUNNER_LABELS="${IZAKHONO_RUNNER_LABELS:-izakhono-owned,linux}"
REPO="${IZAKHONO_GITHUB_REPOSITORY:-bevanshelton-netizen/izakhono-builder}"

log() { printf '[IZAKHONO] %s\n' "$*"; }
fail() { printf '[IZAKHONO][FAIL] %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command missing: $1"
}

[[ "$(id -u)" -eq 0 ]] || fail 'Run as root.'

for cmd in docker curl jq git; do
  require_cmd "$cmd"
done

mkdir -p \
  "${STATE_ROOT}/state" \
  "${STATE_ROOT}/releases/izakhono-super-engine" \
  "${STATE_ROOT}/backups" \
  "${BIN_ROOT}"

chmod 0750 "${STATE_ROOT}" "${BIN_ROOT}"
chmod 0700 "${STATE_ROOT}/state" "${STATE_ROOT}/releases/izakhono-super-engine" "${STATE_ROOT}/backups"

if ! docker info >/dev/null 2>&1; then
  fail 'Docker Engine is not available to the root operator.'
fi

docker network inspect "${EDGE_NETWORK}" >/dev/null 2>&1 || docker network create "${EDGE_NETWORK}" >/dev/null

# Install the checked-in release adapter from the repository checkout.
# The adapter is deliberately copied, not downloaded from an arbitrary host.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_SOURCE="${SCRIPT_DIR}/izakhono-release.reference.sh"
[[ -f "${RELEASE_SOURCE}" ]] || fail "Release adapter not found beside bootstrap script: ${RELEASE_SOURCE}"
install -m 0750 "${RELEASE_SOURCE}" "${BIN_ROOT}/izakhono-release"

cat > "${STATE_ROOT}/owned-runtime.env" <<EOF
IZAKHONO_OWNED_RUNTIME=true
IZAKHONO_EDGE_NETWORK=${EDGE_NETWORK}
IZAKHONO_STATE_ROOT=${STATE_ROOT}
IZAKHONO_RUNNER_LABELS=${RUNNER_LABELS}
EOF
chmod 0600 "${STATE_ROOT}/owned-runtime.env"

cat > "${STATE_ROOT}/node-readiness.json" <<EOF
{
  "schema": "izakhono.owned-node/v1",
  "ok": true,
  "state_root": "${STATE_ROOT}",
  "edge_network": "${EDGE_NETWORK}",
  "runner_labels": "${RUNNER_LABELS}",
  "release_adapter": "${BIN_ROOT}/izakhono-release",
  "github_repository": "${REPO}",
  "runner_registration": "operator_required",
  "public_https": "not_verified_by_bootstrap"
}
EOF
chmod 0640 "${STATE_ROOT}/node-readiness.json"

log 'Owned runtime filesystem prepared.'
log "Persistent state: ${STATE_ROOT}"
log "Edge network: ${EDGE_NETWORK}"
log "Release adapter: ${BIN_ROOT}/izakhono-release"
log "Runner labels required: ${RUNNER_LABELS}"
log 'Runner registration remains an explicit operator action; no token was stored.'
log 'Public HTTPS remains unverified until ingress is configured and acceptance-tested.'
