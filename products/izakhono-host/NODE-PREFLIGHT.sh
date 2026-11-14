#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

fail=0
warn_count=0
check() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    printf 'PASS  %s\n' "$label"
  else
    printf 'FAIL  %s\n' "$label"
    fail=1
  fi
}
warn() {
  printf 'WARN  %s\n' "$1"
  warn_count=$((warn_count+1))
}
check_port() {
  local port="$1"
  if ! ss -ltn "sport = :$port" 2>/dev/null | grep -q LISTEN; then return 0; fi
  docker ps --format '{{.Ports}}' | grep -qE "(0\.0\.0\.0|\[::\]|127\.0\.0\.1):$port->"
}

printf '\nIZAKHONO NODE PREFLIGHT — physical execution environment\n'
printf 'Host: %s\n' "$(hostname 2>/dev/null || echo unknown)"
printf 'UTC:  %s\n\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

check 'Docker installed' command -v docker
check 'Docker Compose available' docker compose version
check 'Docker daemon reachable' docker info
check 'ss networking utility available' command -v ss
check 'curl available' command -v curl
check 'openssl available' command -v openssl
check 'dig available' command -v dig
check 'restic available for encrypted backups' command -v restic
check 'systemd active for service supervision' bash -c 'test "$(ps -p 1 -o comm= | tr -d " ")" = systemd'
check 'IPv4 default route' ip -4 route show default
check 'Outbound DNS resolution' getent hosts github.com
check 'Outbound HTTPS' curl -fsS --max-time 10 https://github.com/ >/dev/null
check 'At least 8 GiB memory available to Linux' bash -c 'awk "/MemTotal/ {exit !($2 >= 8000000)}" /proc/meminfo'
check 'At least 40 GiB free root filesystem space' bash -c 'df -Pk / | awk "NR==2 {exit !($4 >= 40000000)}"'
check 'Persistent storage writable' bash -c 'test -w /var/lib && test -w /opt'

for port in 80 443 8080 8082 8443 25 465 587 110 143 993 995 4190; do
  check "TCP port $port free or already Docker-owned" check_port "$port"
done
check 'DNS UDP port 53 free or Docker-owned' bash -c '! ss -lun "sport = :53" 2>/dev/null | grep -q "\*:53" || docker ps --format "{{.Ports}}" | grep -q "53->53/udp"'
check 'DNS TCP port 53 free or Docker-owned' bash -c '! ss -ltn "sport = :53" 2>/dev/null | grep -q LISTEN || docker ps --format "{{.Ports}}" | grep -q "53->53/tcp"'

if grep -qi microsoft /proc/sys/kernel/osrelease || [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
  warn 'WSL2 detected: NAT does not provide a production public mail/DNS edge by itself.'
  warn 'Before public mail, verify static public IPv4, Windows and router port forwarding, firewall rules, PTR/reverse DNS, and inbound TCP 25 from an independent network.'
fi

if [[ -f .env ]]; then
  check 'Host runtime token configured' bash -c 'grep -q "^HOST_RUNTIME_TOKEN=" .env && ! grep -q "REPLACE_WITH" .env'
  check 'TLS contact configured' bash -c 'grep -q "^TLS_EMAIL=" .env && ! grep -q "REPLACE_WITH" .env'
  if grep -q '^STALWART_API_KEY=REPLACE_WITH' .env; then warn 'Stalwart API token still needs to be created in the admin interface and copied into .env.'; fi
  if grep -q '^SMTP_PASS=REPLACE_WITH' .env; then warn 'Notification mailbox SMTP password is not configured yet.'; fi
  if grep -q '^MAIL_PUBLIC_IP=REPLACE_WITH' .env; then warn 'Static public mail IP has not been verified/configured.'; fi
  if grep -q '^DKIM_SELECTOR=REPLACE_AFTER' .env; then warn 'DKIM selector must be copied from the live Stalwart domain configuration.'; fi
else
  warn '.env not present — bootstrap-owned.sh will create it.'
fi

if timeout 8 bash -c 'exec 3<>/dev/tcp/gmail-smtp-in.l.google.com/25' 2>/dev/null; then
  printf 'PASS  Outbound TCP 25 reachable\n'
else
  warn 'Outbound TCP 25 is blocked or unverified; confirm with the network provider.'
fi

printf '\n'
if (( fail )); then
  echo 'NODE PREFLIGHT: NOT READY'
  exit 1
fi
if (( warn_count > 0 )); then
  echo "NODE PREFLIGHT: HOST READY WITH $warn_count PUBLIC/PRODUCTION WARNINGS"
else
  echo 'NODE PREFLIGHT: READY'
fi
