#!/usr/bin/env bash
set -euo pipefail

SCRIPT="$(dirname "$0")/node01-physical-acceptance.sh"
bash -n "$SCRIPT"

# Static safety checks: the collector must never manufacture LIVE evidence or
# bypass explicit owner acceptance.
grep -q 'live.*false' "$SCRIPT" || { echo '[FAIL] live:false guard missing'; exit 1; }
grep -q 'IZAKHONO_ACCEPTANCE_VERIFIED' "$SCRIPT" || { echo '[FAIL] independent acceptance gate missing'; exit 1; }
grep -q 'physical_host_is_separate.*true' "$SCRIPT" || { echo '[FAIL] physical host separation evidence missing'; exit 1; }
grep -q 'artifact_digest_verified.*true' "$SCRIPT" || { echo '[FAIL] immutable digest evidence missing'; exit 1; }
grep -q 'docker network inspect izakhono-edge' "$SCRIPT" || { echo '[FAIL] edge network verification missing'; exit 1; }
grep -q 'RELEASE_ADAPTER' "$SCRIPT" || { echo '[FAIL] release adapter verification missing'; exit 1; }

# The collector requires root, live runtime checks, HTTPS, exact digest and
# explicit independent acceptance, so it cannot pass in a repository runner.
if grep -Eq "status[[:space:]]*[:=][[:space:]]*['\"]LIVE|live['\"]?[[:space:]]*:[[:space:]]*true" "$SCRIPT"; then
  echo '[FAIL] collector contains a LIVE=true path'
  exit 1
fi

echo '[PASS] NODE01 physical acceptance collector is fail-closed and LIVE-prohibited.'
