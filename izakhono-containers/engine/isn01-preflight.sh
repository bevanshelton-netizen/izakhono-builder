#!/usr/bin/env sh
set -eu

echo "IZAKHONO Engine — ISN-01 preflight"
echo "================================="
echo
fail=0
check_cmd() {
  name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    printf "PASS  %-18s %s\n" "$name" "$(command -v "$name")"
  else
    printf "FAIL  %-18s missing\n" "$name"
    fail=1
  fi
}

check_cmd node
check_cmd docker
check_cmd curl
check_cmd systemctl

if command -v node >/dev/null 2>&1; then
  major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$major" -ge 20 ]; then
    echo "PASS  node-version       $(node -v)"
  else
    echo "FAIL  node-version       $(node -v) (need >=20)"
    fail=1
  fi
fi

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    echo "PASS  docker-daemon      reachable"
  else
    echo "FAIL  docker-daemon      not reachable"
    fail=1
  fi
fi

if [ -n "${IZ_CONTROL_URL:-}" ]; then
  if curl -fsS "${IZ_CONTROL_URL%/}/api/health" >/tmp/iz-health.json 2>/dev/null; then
    echo "PASS  control-plane      reachable"
    cat /tmp/iz-health.json
    echo
  else
    echo "FAIL  control-plane      ${IZ_CONTROL_URL} unreachable"
    fail=1
  fi
else
  echo "WARN  control-plane      IZ_CONTROL_URL not set; connectivity not tested"
fi

if [ -n "${IZ_NODE_ENROLL_TOKEN:-}" ]; then
  echo "PASS  enroll-token       present"
else
  echo "WARN  enroll-token       IZ_NODE_ENROLL_TOKEN not set"
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "RESULT: ISN-01 is ready for IZAKHONO Engine enrollment."
  exit 0
else
  echo "RESULT: Preflight failed. Fix the FAIL items before enrollment."
  exit 1
fi
