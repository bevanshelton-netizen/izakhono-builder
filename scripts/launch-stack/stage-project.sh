#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo 'Run as root (sudo).'
  exit 1
fi

REPO="${1:-}"
OPTION="${2:-}"
[ -d "$REPO" ] || { echo 'Usage: stage-project.sh <repo-path> [--with-db]'; exit 2; }
MANIFEST="$REPO/.izakhono.json"
[ -f "$MANIFEST" ] || { echo 'Repository has no .izakhono.json contract.'; exit 1; }
command -v jq >/dev/null
command -v docker >/dev/null

docker inspect izakhono-caddy >/dev/null 2>&1 || { echo 'Launch stack is not running.'; exit 1; }

SLUG="$(jq -r '.slug // empty' "$MANIFEST")"
CONTEXT="$(jq -r '.build_context // empty' "$MANIFEST")"
DOCKERFILE="$(jq -r '.dockerfile_path // empty' "$MANIFEST")"
PORT="$(jq -r '.container_port // empty' "$MANIFEST")"
HEALTH="$(jq -r '.health_path // empty' "$MANIFEST")"

[[ "$SLUG" =~ ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$ ]] || { echo 'Unsafe slug.'; exit 1; }
[[ "$PORT" =~ ^[0-9]{1,5}$ ]] && [ "$PORT" -ge 1 ] && [ "$PORT" -le 65535 ] || { echo 'Invalid port.'; exit 1; }
[[ "$HEALTH" =~ ^/[A-Za-z0-9._~:/?%+=,@-]*$ ]] || { echo 'A safe HTTP health_path is required.'; exit 1; }
for P in "$CONTEXT" "$DOCKERFILE"; do
  [ -n "$P" ] && [[ "$P" != /* ]] && [[ "$P" != *\\* ]] && [[ "/$P/" != *"/../"* ]] || { echo 'Unsafe repository path in manifest.'; exit 1; }
done
[ -d "$REPO/$CONTEXT" ] || { echo 'Build context missing.'; exit 1; }
[ -f "$REPO/$DOCKERFILE" ] || { echo 'Dockerfile missing.'; exit 1; }

if jq -e '.alpha.preflight == true' "$MANIFEST" >/dev/null 2>&1; then
  GATE="$REPO/scripts/izakhono/alpha-preflight.sh"
  [ -f "$GATE" ] || { echo 'Manifest requires the fixed preflight but the reviewed script is missing.'; exit 1; }
  echo 'Running repository-reviewed local preflight...'
  bash "$GATE"
fi

if jq -e '.alpha.rehearsal == true' "$MANIFEST" >/dev/null 2>&1; then
  GATE="$REPO/scripts/izakhono/alpha-rehearsal.sh"
  [ -f "$GATE" ] || { echo 'Manifest requires the fixed rehearsal but the reviewed script is missing.'; exit 1; }
  echo 'Running repository-reviewed local rehearsal...'
  bash "$GATE"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$OPTION" = '--with-db' ] && [ ! -f "/opt/izakhono/secrets/${SLUG}.db.env" ]; then
  bash "$SCRIPT_DIR/provision-project-db.sh" "$SLUG"
fi

RELEASE="$(git -C "$REPO" rev-parse --short=12 HEAD 2>/dev/null || date -u +%Y%m%d%H%M%S)"
IMAGE="izakhono/${SLUG}:${RELEASE}"
REGISTRY_IMAGE="localhost:5000/${SLUG}:${RELEASE}"
CONTAINER="izakhono-stage-${SLUG}"
SECRET_DIR=/opt/izakhono/secrets
EVIDENCE_DIR=/opt/izakhono/evidence

mkdir -p "$EVIDENCE_DIR"
echo "Building local IZAKHONO stage for $SLUG from $RELEASE..."
docker build -f "$REPO/$DOCKERFILE" -t "$IMAGE" "$REPO/$CONTEXT"
docker tag "$IMAGE" "$REGISTRY_IMAGE"
docker push "$REGISTRY_IMAGE" >/dev/null

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
RUN_ARGS=(run -d --name "$CONTAINER" --restart unless-stopped --network izakhono_public)
[ -f "$SECRET_DIR/${SLUG}.db.env" ] && RUN_ARGS+=(--env-file "$SECRET_DIR/${SLUG}.db.env")
[ -f "$SECRET_DIR/${SLUG}.env" ] && RUN_ARGS+=(--env-file "$SECRET_DIR/${SLUG}.env")
RUN_ARGS+=("$IMAGE")
docker "${RUN_ARGS[@]}" >/dev/null
docker network connect izakhono_private "$CONTAINER" 2>/dev/null || true

healthy=0
for i in $(seq 1 45); do
  if docker exec izakhono-caddy wget -q -O /dev/null "http://${CONTAINER}:${PORT}${HEALTH}" 2>/dev/null; then
    healthy=1
    break
  fi
  if [ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null || true)" != true ]; then break; fi
  sleep 2
done
if [ "$healthy" -ne 1 ]; then
  echo '[FAIL] Local staged candidate failed the internal health gate.'
  docker logs --tail 100 "$CONTAINER" || true
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  exit 1
fi

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
EVIDENCE="$EVIDENCE_DIR/${SLUG}-stage-${NOW//[:]/}.txt"
umask 077
cat > "$EVIDENCE" <<EOF
IZAKHONO_LOCAL_STAGE_EVIDENCE_VERSION=1
PROJECT_SLUG=$SLUG
GIT_RELEASE=$RELEASE
STAGED_UTC=$NOW
IMAGE=$IMAGE
CONTAINER=$CONTAINER
INTERNAL_HEALTH_GATE=pass
PUBLIC_HTTPS_GATE=not-run
APP_COMMERCIAL_READINESS=not-run
COMMERCIAL_PUBLICATION=false
EOF
sha256sum "$EVIDENCE" > "$EVIDENCE.sha256"
chmod 600 "$EVIDENCE" "$EVIDENCE.sha256"

printf '%s|%s|%s|%s\n' "$CONTAINER" "$PORT" "$HEALTH" "$IMAGE" > "/opt/izakhono/state/${SLUG}.stage"
chmod 640 "/opt/izakhono/state/${SLUG}.stage"

echo "[PASS] $SLUG is running on our IZAKHONO host and passed the internal health gate."
echo "Stage evidence: $EVIDENCE"
echo 'No DNS, public HTTPS, payment or commercial-readiness claim was made. Use launch-project.sh only when the real public domain is ready.'
