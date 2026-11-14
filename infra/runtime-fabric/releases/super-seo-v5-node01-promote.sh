#!/usr/bin/env bash
set -euo pipefail

RELEASE_DIR="${SUPER_SEO_RELEASE_DIR:-$HOME/izakhono/runtime-fabric/releases/super-seo-v5}"
COMPOSE_FILE="$RELEASE_DIR/super-seo-v5-node01.compose.yaml"
VERIFY_SCRIPT="$RELEASE_DIR/verify-super-seo-v5-node01.sh"

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Missing NODE01 compose contract: $COMPOSE_FILE" >&2
  exit 1
fi
if [[ ! -f "$VERIFY_SCRIPT" ]]; then
  echo "Missing NODE01 health verifier: $VERIFY_SCRIPT" >&2
  exit 1
fi

chmod +x "$VERIFY_SCRIPT"
docker compose -f "$COMPOSE_FILE" up -d --build
"$VERIFY_SCRIPT"
echo "SUPER SEO V5 NODE01 promotion: PASS"
