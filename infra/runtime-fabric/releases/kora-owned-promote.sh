#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="${KORA_RELEASE_DIR:-$HOME/izakhono/runtime-fabric/releases}"
SOURCE_DIR="$BASE_DIR/kora-tv-source"
COMPOSE_FILE="$BASE_DIR/kora-owned.compose.yaml"
ENV_FILE="$BASE_DIR/kora-owned.env"
REPO_URL="${KORA_REPO_URL:-https://github.com/bevanshelton-netizen/Downloads.git}"
RELEASE_SHA="${KORA_RELEASE_SHA:-b60a79f0833cc7efa6f7ec87a777ed5ddc68dea2}"

[[ -f "$COMPOSE_FILE" ]] || { echo "Missing KORA owned compose contract" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "Missing protected KORA runtime env: $ENV_FILE" >&2; exit 1; }
command -v docker >/dev/null || { echo "Docker is required" >&2; exit 1; }
command -v git >/dev/null || { echo "Git is required" >&2; exit 1; }

if [[ ! -d "$SOURCE_DIR/.git" ]]; then
  rm -rf "$SOURCE_DIR"
  git clone --filter=blob:none "$REPO_URL" "$SOURCE_DIR"
fi

git -C "$SOURCE_DIR" fetch --depth 1 origin "$RELEASE_SHA"
git -C "$SOURCE_DIR" checkout --detach "$RELEASE_SHA"

cd "$BASE_DIR"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

for attempt in {1..20}; do
  if curl -fsS http://127.0.0.1:8300/api/health >/tmp/kora-health.json 2>/dev/null; then
    cat /tmp/kora-health.json
    echo "KORA owned runtime liveness: PASS"
    exit 0
  fi
  sleep 5
done

echo "KORA owned runtime liveness: FAIL" >&2
docker compose -f "$COMPOSE_FILE" ps >&2 || true
exit 1
