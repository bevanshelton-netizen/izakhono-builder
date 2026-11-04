#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
EXPECTED_RELEASE="${1:-${EXPECTED_RELEASE:-}}"
if [[ ! "$EXPECTED_RELEASE" =~ ^[0-9a-f]{40}$ ]]; then echo "expected release must be exactly 40 lowercase hexadecimal characters" >&2; exit 30; fi
current_branch="$(git branch --show-current)"
current_release="$(git rev-parse HEAD)"
if [[ "$current_branch" != "main" ]]; then echo "promotion refused: branch must be main" >&2; exit 31; fi
if [[ -n "$(git status --porcelain)" ]]; then echo "promotion refused: working tree is not clean" >&2; exit 32; fi
if [[ "$current_release" != "$EXPECTED_RELEASE" ]]; then echo "promotion refused: HEAD does not match expected release" >&2; exit 33; fi
if [[ "${NODE01_ALLOW_DEPLOY:-0}" != "1" ]]; then echo "promotion refused: NODE01_ALLOW_DEPLOY=1 is required" >&2; exit 34; fi
./infra/node01/deploy-nav-node01.sh
./infra/node01/verify-node01-nav.sh
./infra/node01/node01-release-receipt.sh
echo "NODE01 production promotion completed and receipt generated."
