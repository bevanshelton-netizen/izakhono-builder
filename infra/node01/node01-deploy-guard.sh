#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

NODE_NAME="${NODE_NAME:-NODE01}"
EXPECTED_BRANCH="${EXPECTED_BRANCH:-main}"
EXPECTED_REMOTE="${EXPECTED_REMOTE:-origin}"

current_branch="$(git branch --show-current)"
current_remote="$(git config --get "branch.${current_branch}.remote" || true)"

if [[ "$current_branch" != "$EXPECTED_BRANCH" ]]; then
  echo "[NODE01] deployment refused: branch '$current_branch' is not '$EXPECTED_BRANCH'" >&2
  exit 10
fi

if [[ -n "$current_remote" && "$current_remote" != "$EXPECTED_REMOTE" ]]; then
  echo "[NODE01] deployment refused: branch remote '$current_remote' is not '$EXPECTED_REMOTE'" >&2
  exit 11
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[NODE01] deployment refused: working tree is not clean" >&2
  exit 12
fi

release="$(git rev-parse HEAD)"
short_release="$(git rev-parse --short HEAD)"

echo "[NODE01] deployment guard PASS"
echo "[NODE01] node=$NODE_NAME branch=$current_branch release=$release ($short_release)"

if [[ "${NODE01_ALLOW_DEPLOY:-0}" != "1" ]]; then
  echo "[NODE01] execution gate: set NODE01_ALLOW_DEPLOY=1 on NODE01 to permit deployment"
  exit 20
fi

exec ./infra/node01/deploy-nav-node01.sh
