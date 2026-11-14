#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
if [[ -f .env ]]; then set -a; . ./.env; set +a; fi

failed=0
pass_count=0
fail_count=0
warn_count=0

pass() { printf 'PASS  %s\n' "$1"; pass_count=$((pass_count+1)); }
fail() { printf 'FAIL  %s\n' "$1"; fail_count=$((fail_count+1)); failed=1; }
warn() { printf 'WARN  %s\n' "$1"; warn_count=$((warn_count+1)); }

check_cmd() {
  local label="$1" cmd="$2"
  if command -v "$cmd" >/dev/null 2>&1; then pass "$label"; else fail "$label"; fi
}
check_port_owned_or_free() {
  local label="$1" port="$2"
  if ! ss -ltn "sport = :$port" 2>/dev/null | grep -q LISTEN; then
    pass "$label (free)"
  elif docker ps --format '{{.Ports}}' | grep -qE "(0\.0\.0\.0|\[::\]|127\.0\.0\.1):$port->"; then
    pass "$label (Docker-owned)"
  else
    fail "$label (occupied by non-Docker process)"
  fi
}

printf '\nIZAKHONO NODE01 LOCAL COMPLIANCE GATE\n'
printf 'Physical host: %s\n' "$(hostname 2>/dev/null || echo unknown)"
printf 'UTC: %s\n\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

check_cmd 'Docker installed' docker
check_cmd 'Docker CLI available' docker
check_cmd 'ss networking utility available' ss
check_cmd 'curl available' curl
check_cmd 'Python available' python3
check_cmd 'jq available' jq
check_cmd 'dig available' dig
check_cmd 'OpenSSL available' openssl
check_cmd 'Restic backup tool available' restic

if docker info >/dev/null 2>&1; then pass 'Docker daemon reachable'; else fail 'Docker daemon reachable'; fi
if docker compose version >/dev/null 2>&1; then pass 'Docker Compose operational'; else fail 'Docker Compose operational'; fi

if [[ -f docker-compose.owned.yml ]]; then pass 'Owned compose definition present'; else fail 'Owned compose definition present'; fi
if [[ -f .env ]]; then
  pass '.env present'
  if grep -q '^HOST_RUNTIME_TOKEN=' .env && ! grep -q 'REPLACE_WITH' .env; then pass 'Host runtime token generated'; else fail 'Host runtime token generated'; fi
  if grep -q '^TLS_EMAIL=' .env && ! grep -q 'REPLACE_WITH' .env; then pass 'TLS contact configured'; else fail 'TLS contact configured'; fi
else
  fail '.env present for activation'
fi

for port in 80 443 8080 8082 8443 53 25 465 587 110 143 993 995 4190; do
  check_port_owned_or_free "TCP :$port" "$port"
done
if ! ss -lun 'sport = :53' 2>/dev/null | grep -q '\*:53'; then
  pass 'DNS UDP :53 (free)'
elif docker ps --format '{{.Ports}}' | grep -q '53->53/udp'; then
  pass 'DNS UDP :53 (Docker-owned)'
else
  fail 'DNS UDP :53 (non-Docker listener)'
fi

if ip -4 route show default >/dev/null 2>&1; then pass 'IPv4 default route'; else fail 'IPv4 default route'; fi
if ip -6 addr show scope global | grep -q 'inet6'; then pass 'Global IPv6 address'; else warn 'Global IPv6 address not present'; fi
if getent hosts github.com >/dev/null 2>&1; then pass 'Outbound DNS resolution'; else fail 'Outbound DNS resolution'; fi
if curl -fsS --max-time 10 https://github.com/ >/dev/null; then pass 'Outbound HTTPS'; else fail 'Outbound HTTPS'; fi

if [[ -w /var/lib && -w /opt ]]; then pass 'Persistent host storage writable'; else fail 'Persistent host storage writable'; fi

if docker compose --env-file .env -f docker-compose.owned.yml config >/dev/null 2>&1; then
  pass 'Owned host compose configuration valid'
else
  fail 'Owned host compose configuration valid'
fi

HOST_CID="$(docker compose --env-file .env -f docker-compose.owned.yml ps -q host-runtime 2>/dev/null || true)"
if [[ -n "$HOST_CID" ]] && curl -fsS --max-time 5 http://127.0.0.1:8080/health >/dev/null; then
  pass 'Native host runtime health'
else
  fail 'Native host runtime health'
fi

for service in postgres minio valkey edge mail-bridge roundcube; do
  CID="$(docker compose --env-file .env -f docker-compose.owned.yml ps -q "$service" 2>/dev/null || true)"
  if [[ -n "$CID" ]]; then pass "$service container created"; else warn "$service container not found"; fi
done

MAIL_MODE="${MAIL_MODE:-local}"
if [[ "$MAIL_MODE" == "local" ]]; then
  MAIL_CID="$(docker compose --env-file .env -f mail/docker-compose.mail.yml ps -q stalwart 2>/dev/null || true)"
  if [[ -n "$MAIL_CID" ]]; then
    HEALTH="$(docker inspect -f '{{.State.Health.Status}}' "$MAIL_CID" 2>/dev/null || true)"
    [[ "$HEALTH" == "healthy" ]] && pass 'Local Stalwart mail server healthy' || fail "Local Stalwart mail server health ($HEALTH)"
  else
    fail 'Local Stalwart mail server container present'
  fi
elif [[ "$MAIL_MODE" == "remote" ]]; then
  if curl -fsS --max-time 8 "${STALWART_API_URL%/}/healthz/live" >/dev/null 2>&1; then pass 'Remote Stalwart health endpoint reachable'; else fail 'Remote Stalwart health endpoint reachable'; fi
else
  fail 'MAIL_MODE is local or remote'
fi

if curl -fsS --max-time 5 http://127.0.0.1:8082/api/ready >/dev/null 2>&1; then
  pass 'IZAKHONO Mail Control Plane ready against Stalwart'
else
  warn 'Mail Control Plane API token/backend readiness pending; mailbox provisioning remains blocked'
fi

if [[ -f .backup.env ]]; then
  pass 'Encrypted off-host backup credentials file present'
else
  warn 'Restic .backup.env not configured; off-host backups cannot run yet'
fi

if [[ -s mail/secrets/mail_admin_password && -f mail/admin-ui/index.html ]]; then
  pass 'Owner-only Mail Control Centre UI and credential staged'
else
  warn 'Mail Control Centre owner credential or static UI is not staged'
fi
if [[ -f .env ]] && ! grep -q '^MAIL_ADMIN_PASSWORD_HASH=REPLACE_WITH' .env; then
  pass 'Mail Control Centre Basic Auth hash configured'
else
  warn 'Mail Control Centre Basic Auth hash is not configured'
fi

if [[ -f .env ]] && grep -q '^MAIL_PUBLIC_IP=REPLACE_WITH' .env; then
  warn 'Static public mail IP not configured'
fi
if [[ -f .env ]] && grep -q '^DKIM_SELECTOR=REPLACE_AFTER' .env; then
  warn 'DKIM selector must be copied from the live Stalwart domain configuration'
fi
if [[ -f .env ]] && grep -q '^SMTP_PASS=REPLACE_WITH' .env; then
  warn 'Notifications mailbox password not configured; application email sending is not ready'
fi

if grep -qi microsoft /proc/sys/kernel/osrelease || [[ -n "${WSL_DISTRO_NAME:-}" ]]; then
  warn 'WSL2 detected: public mail/DNS ingress is not accepted until static IP, Windows/router forwarding, PTR and independent external tests pass'
fi

printf '\nRESULTS: PASS=%d FAIL=%d WARN=%d\n' "$pass_count" "$fail_count" "$warn_count"
if (( failed )); then
  echo 'NODE LOCAL COMPLIANCE: FAILED'
  exit 1
fi
if (( warn_count > 0 )); then
  echo 'NODE LOCAL COMPLIANCE: PASSED WITH PUBLIC/MAIL PRODUCTION GATES PENDING'
else
  echo 'NODE LOCAL COMPLIANCE: PASSED'
fi
