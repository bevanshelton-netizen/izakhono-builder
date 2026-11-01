#!/usr/bin/env bash
set -euo pipefail

# Owner-run only. This script never declares LIVE and never fabricates evidence.
# NODE01-NODE04 are logical software/runtime identities. The runtime host is
# separate and may be physical, virtual, owned, or an approved external adapter.
# Evidence is emitted only when every required check passes on the actual host.

STATE_ROOT="${IZAKHONO_STATE_ROOT:-/opt/izakhono}"
NODE_ID="${IZAKHONO_NODE_ID:-NODE01}"
RELEASE_ADAPTER="${IZAKHONO_RELEASE_ADAPTER:-/opt/izakhono/bin/izakhono-release}"
HTTPS_URL="${IZAKHONO_ACCEPTANCE_HTTPS_URL:-}"
HEALTH_URL="${IZAKHONO_ACCEPTANCE_HEALTH_URL:-}"
EXPECTED_IMAGE="${IZAKHONO_EXPECTED_IMAGE:-}"
EXPECTED_DIGEST="${IZAKHONO_EXPECTED_DIGEST:-}"
OUTPUT="${1:-${STATE_ROOT}/state/activation/${NODE_ID}-runtime-evidence.json}"

fail() { echo "[FAIL] $*" >&2; exit 1; }
pass() { echo "[PASS] $*"; }

[[ "$(id -u)" -eq 0 ]] || fail "must run as root"
[[ "$NODE_ID" =~ ^NODE0[1-4]$ ]] || fail "unsupported software node identity: $NODE_ID"
[[ -d "$STATE_ROOT" ]] || fail "persistent state root missing: $STATE_ROOT"
command -v docker >/dev/null 2>&1 || fail "Docker Engine unavailable"
docker info >/dev/null 2>&1 || fail "Docker Engine not operational"
command -v docker compose >/dev/null 2>&1 || fail "Docker Compose unavailable"
[[ -x "$RELEASE_ADAPTER" ]] || fail "release adapter missing or not executable: $RELEASE_ADAPTER"

docker network inspect izakhono-edge >/dev/null 2>&1 || fail "izakhono-edge network missing"
[[ -n "$HTTPS_URL" ]] || fail "IZAKHONO_ACCEPTANCE_HTTPS_URL is required"
[[ -n "$HEALTH_URL" ]] || fail "IZAKHONO_ACCEPTANCE_HEALTH_URL is required"
[[ -n "$EXPECTED_IMAGE" ]] || fail "IZAKHONO_EXPECTED_IMAGE is required"
[[ -n "$EXPECTED_DIGEST" ]] || fail "IZAKHONO_EXPECTED_DIGEST is required"
[[ "$EXPECTED_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || fail "expected digest must be sha256:<64 hex>"
[[ "${IZAKHONO_ACCEPTANCE_VERIFIED:-}" == "true" ]] || fail "independent acceptance must explicitly set IZAKHONO_ACCEPTANCE_VERIFIED=true"

HTTPS_STATUS="$(curl -k -L -sS -o /dev/null -w '%{http_code}' --max-time 15 "$HTTPS_URL")" || fail "public HTTPS check failed"
[[ "$HTTPS_STATUS" =~ ^2[0-9][0-9]$ ]] || fail "public HTTPS returned HTTP $HTTPS_STATUS"
pass "public HTTPS verified"

HEALTH_STATUS="$(curl -k -L -sS -o /dev/null -w '%{http_code}' --max-time 15 "$HEALTH_URL")" || fail "health endpoint check failed"
[[ "$HEALTH_STATUS" =~ ^2[0-9][0-9]$ ]] || fail "health endpoint returned HTTP $HEALTH_STATUS"
pass "health endpoint verified"

RUNNING_IMAGE_ID="$(docker image inspect "$EXPECTED_IMAGE" --format '{{.Id}}' 2>/dev/null || true)"
[[ -n "$RUNNING_IMAGE_ID" ]] || fail "expected image is not present locally: $EXPECTED_IMAGE"

CONTAINER_ID="$(docker ps -q --filter "ancestor=$EXPECTED_IMAGE" | head -n1)"
[[ -n "$CONTAINER_ID" ]] || fail "no running container found for expected image: $EXPECTED_IMAGE"
CONTAINER_IMAGE_ID="$(docker inspect "$CONTAINER_ID" --format '{{.Image}}')"
[[ "$CONTAINER_IMAGE_ID" == "$RUNNING_IMAGE_ID" ]] || fail "running container image identity does not match expected image"

IMAGE_DIGEST="$(docker image inspect "$EXPECTED_IMAGE" --format '{{index .RepoDigests 0}}' 2>/dev/null | sed 's/^.*@//' || true)"
[[ "$IMAGE_DIGEST" == "$EXPECTED_DIGEST" ]] || fail "immutable artifact digest mismatch: got '${IMAGE_DIGEST:-missing}', expected '$EXPECTED_DIGEST'"
pass "exact immutable artifact digest verified"

HOSTNAME_VALUE="$(hostname -f 2>/dev/null || hostname)"
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
mkdir -p "$(dirname "$OUTPUT")"
TMP="${OUTPUT}.tmp.$$"

cat > "$TMP" <<EOF
{
  "schema": "izakhono.runtime-evidence/v1",
  "slug": "${IZAKHONO_ACCEPTANCE_SLUG:-faisready}",
  "target": "${NODE_ID}",
  "node_identity_type": "software-runtime",
  "runtime_binding_schema": "izakhono.runtime-binding/v1",
  "physical_host_is_separate": true,
  "runtime_host": "${HOSTNAME_VALUE}",
  "owned_runtime": true,
  "docker_verified": true,
  "edge_network_verified": true,
  "artifact_image": "${EXPECTED_IMAGE}",
  "artifact_digest_verified": true,
  "health_verified": true,
  "https_verified": true,
  "acceptance_verified": true,
  "live": false,
  "verified_at": "${TIMESTAMP}"
}
EOF
mv -f "$TMP" "$OUTPUT"
chmod 0644 "$OUTPUT"
pass "logical runtime acceptance evidence written: $OUTPUT"
echo "[GATE] Promotion remains separate; LIVE is intentionally false."
