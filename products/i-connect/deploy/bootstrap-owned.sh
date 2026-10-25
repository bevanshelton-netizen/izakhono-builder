#!/usr/bin/env bash
set -euo pipefail

# IZAKHONO-owned I-CONNECT bootstrap.
# Run on a fresh Ubuntu/Debian Linux server as root.
# This script prepares the host; it does not create accounts, carrier service,
# payment credentials, or claim that I-CONNECT is production-live.

APP_DIR="${I_CONNECT_APP_DIR:-/opt/izakhono/i-connect}"
REPO_URL="${I_CONNECT_REPO_URL:-https://github.com/bevanshelton-netizen/izakhono-builder.git}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "ERROR: run as root (or through sudo)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable --now docker

install -d -m 0750 "$(dirname "$APP_DIR")"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --depth=1 origin main
  git -C "$APP_DIR" reset --hard origin/main
else
  git clone --depth=1 "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR/products/i-connect"

if [[ ! -f deploy/.env ]]; then
  cp deploy/.env.example deploy/.env
  chmod 0600 deploy/.env
  echo "Created $APP_DIR/products/i-connect/deploy/.env"
  echo "ACTION REQUIRED: populate protected production values before starting the stack."
fi

# Only expose web ports publicly; SSH remains under the operator's existing policy.
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

mkdir -p /var/lib/i-connect-backups
chmod 0700 /var/lib/i-connect-backups

cat <<'EOF'

IZAKHONO I-CONNECT HOST PREPARED.

Next:
  1. Set deploy/.env securely.
  2. Set I_CONNECT_HOST to the approved DNS hostname.
  3. Confirm DNS A/AAAA records point to this server.
  4. Run: docker compose -f deploy/docker-compose.owned.yml up -d --build
  5. Verify: docker compose -f deploy/docker-compose.owned.yml ps
  6. Verify: curl -fsS https://$I_CONNECT_HOST/api/health

Live PSTN, real billing and production onboarding remain gated by their
respective carrier/payment/identity readiness checks.
EOF
