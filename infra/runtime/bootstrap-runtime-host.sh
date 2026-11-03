#!/usr/bin/env bash
set -euo pipefail

# One-command bootstrap for an approved IZAKHONO Linux runtime host.
# NODE01-NODE04 are logical software/runtime identities; the host is separate.
# This script installs pinned runtime tooling and runs the real host preflight.
# It never manufactures evidence and never declares LIVE.

REPO="${IZAKHONO_REPO:-bevanshelton-netizen/izakhono-builder}"
REF="${IZAKHONO_RUNTIME_BOOTSTRAP_REF:-main}"
STATE_ROOT="${IZAKHONO_STATE_ROOT:-/opt/izakhono}"
NODE_ID="${IZAKHONO_NODE_ID:-NODE01}"
RUNTIME_HOST="${IZAKHONO_RUNTIME_HOST_NAME:-$(hostname -s)}"
BIN_DIR="${STATE_ROOT}/bin"
TMP_DIR="${STATE_ROOT}/state/bootstrap"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${REF}/infra/runtime"

fail() { echo "BOOTSTRAP BLOCKED: $*" >&2; exit 2; }

[[ "$(id -u)" -eq 0 ]] || fail "run as root on the approved Linux runtime host"
case "$NODE_ID" in NODE01|NODE02|NODE03|NODE04) ;; *) fail "invalid logical node identity: $NODE_ID" ;; esac
command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required"

mkdir -p "$BIN_DIR" "$TMP_DIR"
chmod 750 "$STATE_ROOT" "$BIN_DIR" "$TMP_DIR"

install_pinned() {
  local name="$1" sha="$2"
  local tmp="${TMP_DIR}/${name}.tmp"
  curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
    "${RAW_BASE}/${name}" -o "$tmp"
  echo "${sha}  ${tmp}" | sha256sum -c - >/dev/null || fail "checksum mismatch for $name"
  install -m 0750 "$tmp" "${BIN_DIR}/${name}"
  rm -f "$tmp"
}

# Pin every installed runtime component to an immutable Git commit.
# Update this ref and the checksums together when the bundle changes.
REF_COMMIT="${IZAKHONO_RUNTIME_BOOTSTRAP_COMMIT:-9f5e34761018452bb0b91872bb5897aebe93f218}"
RAW_BASE="https://raw.githubusercontent.com/${REPO}/${REF_COMMIT}/infra/runtime"

install_pinned "host-preflight.sh" "395290e6b85237a747be8972b04bf0ac274cdc12"
install_pinned "activate-runtime-host.sh" "1ba328225146fbb79933b3a29511ac7b0a8f0177"
install_pinned "izakhono-release.reference.sh" "44a722d1c8954e69be85f86a44280b0003f8b3c6"

# The reference adapter is intentionally installed under the canonical runtime name.
ln -sfn "${BIN_DIR}/izakhono-release.reference.sh" "${BIN_DIR}/izakhono-release"

export IZAKHONO_NODE_ID="$NODE_ID"
export IZAKHONO_RUNTIME_HOST_NAME="$RUNTIME_HOST"
export IZAKHONO_STATE_ROOT="$STATE_ROOT"
export IZAKHONO_PRECHECK="${BIN_DIR}/host-preflight.sh"
export IZAKHONO_RELEASE_ADAPTER="${BIN_DIR}/izakhono-release"

"${BIN_DIR}/host-preflight.sh"

cat <<EOF

IZAKHONO RUNTIME HOST BOOTSTRAP COMPLETE
Logical Node: ${NODE_ID}
Runtime Host: ${RUNTIME_HOST}
State Root:   ${STATE_ROOT}

Installed:
  - host-preflight.sh
  - activate-runtime-host.sh
  - izakhono-release.reference.sh

The host is preflighted for runtime deployment. No application has been promoted
and LIVE remains false. Provide an exact immutable release descriptor through
IZAKHONO_ARTIFACT_FILE before running activate-runtime-host.sh.
EOF
