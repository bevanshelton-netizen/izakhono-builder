#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ "${NODE01_ALLOW_DEPLOY:-0}" != "1" ]]; then
  echo "[NODE01] deployment blocked: set NODE01_ALLOW_DEPLOY=1 to authorize production deployment." >&2
  exit 20
fi

branch="$(git branch --show-current)"
if [[ "$branch" != "main" ]]; then
  echo "[NODE01] deployment blocked: expected branch main, got $branch" >&2
  exit 21
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[NODE01] deployment blocked: working tree is not clean." >&2
  exit 22
fi

remote="$(git remote get-url origin 2>/dev/null || true)"
if [[ "$remote" != *"bevanshelton-netizen/izakhono-builder"* ]]; then
  echo "[NODE01] deployment blocked: unexpected origin remote." >&2
  exit 23
fi

printf '[NODE01] deployment authorization accepted. release=%s\n' "$(git rev-parse HEAD)"
exec ./infra/node01/deploy-nav-node01.sh
