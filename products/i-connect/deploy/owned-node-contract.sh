#!/usr/bin/env bash
set -euo pipefail

# I-CONNECT owned-runtime admission contract.
# This script is intentionally read-only: it verifies a candidate IZAKHONO
# compute node before any production deployment is permitted.

fail=0
pass() { printf '[PASS] %s\n' "$1"; }
fail() { printf '[FAIL] %s\n' "$1" >&2; fail=1; }

command -v docker >/dev/null 2>&1 && pass 'Docker is installed' || fail 'Docker is required'
command -v git >/dev/null 2>&1 && pass 'Git is installed' || fail 'Git is required'
command -v curl >/dev/null 2>&1 && pass 'curl is installed' || fail 'curl is required'

docker info >/dev/null 2>&1 && pass 'Docker daemon is reachable' || fail 'Docker daemon is not reachable'
docker compose version >/dev/null 2>&1 && pass 'Docker Compose is available' || fail 'Docker Compose is required'

if [[ "$(id -u)" -eq 0 ]]; then
  pass 'Running with root privileges'
else
  fail 'Run admission verification as root'
fi

if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active --quiet docker && pass 'Docker service is active' || fail 'Docker service is not active'
else
  fail 'systemd is required for the reference owned-node deployment'
fi

if command -v ufw >/dev/null 2>&1; then
  pass 'UFW is installed'
else
  fail 'UFW is required for the reference owned-node deployment'
fi

for port in 80 443; do
  if command -v ss >/dev/null 2>&1 && ss -ltn | awk '{print $4}' | grep -Eq ":${port}$"; then
    printf '[INFO] Port %s is already listening; deployment must reconcile ownership before activation.\n' "$port"
  else
    pass "Port ${port} is available"
  fi
done

APP_DIR="${I_CONNECT_APP_DIR:-/opt/izakhono/i-connect}"
if [[ -d "$APP_DIR/products/i-connect" ]]; then
  pass "I-CONNECT source tree exists at $APP_DIR"
else
  printf '[INFO] I-CONNECT source tree is not present yet at %s; bootstrap-owned.sh will provision it.\n' "$APP_DIR"
fi

if [[ -d /var/lib/i-connect-backups ]]; then
  [[ "$(stat -c '%a' /var/lib/i-connect-backups 2>/dev/null || true)" == "700" ]] && pass 'Backup directory is permissioned 0700' || fail 'Backup directory must be permissioned 0700'
else
  printf '[INFO] Backup directory will be created by bootstrap-owned.sh.\n'
fi

if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  printf '[INFO] Candidate OS: %s %s\n' "${NAME:-unknown}" "${VERSION_ID:-unknown}"
fi

if (( fail != 0 )); then
  echo 'I-CONNECT owned-node admission FAILED.' >&2
  exit 1
fi

echo 'I-CONNECT owned-node admission PASSED.'
echo 'This verifies infrastructure readiness only; it does not activate PSTN, billing, carrier service, or production onboarding.'
