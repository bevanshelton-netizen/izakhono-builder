#!/usr/bin/env bash
set -euo pipefail

ROOT="${NODE01_INSTALL_ROOT:-/opt/izakhono/node01-runtime}"
REPO_URL="${NODE01_REPO_URL:-https://github.com/bevanshelton-netizen/izakhono-builder.git}"

command -v docker >/dev/null || { echo "[STOP] Docker is required."; exit 1; }
command -v git >/dev/null || { echo "[STOP] Git is required."; exit 1; }
command -v curl >/dev/null || { echo "[STOP] curl is required."; exit 1; }
: "${NODE01_ADMIN_TOKEN:?Set NODE01_ADMIN_TOKEN before installation}"

mkdir -p "$(dirname "$ROOT")"
if [[ -d "$ROOT/.git" ]]; then
  git -C "$ROOT" pull --ff-only
else
  git clone "$REPO_URL" "$ROOT"
fi
cd "$ROOT"

echo "[1/7] Building owned NODE01 control runtime..."
docker compose build

echo "[2/7] Starting control plane + private registry..."
docker compose up -d

echo "[3/7] Verifying control plane..."
curl -fsS http://127.0.0.1:8090/health
printf '\n'
echo "[4/7] Verifying private registry..."
curl -fsS http://127.0.0.1:5000/v2/
printf '\n'
echo "[5/7] Installing backup service..."
install -m 0755 backup-node01.sh "$ROOT/backup-node01.sh"
install -m 0644 node01-backup.service /etc/systemd/system/node01-backup.service
install -m 0644 node01-backup.timer /etc/systemd/system/node01-backup.timer
systemctl daemon-reload
systemctl enable --now node01-backup.timer

echo "[6/7] Creating first backup..."
NODE01_BACKUP_ROOT="${NODE01_BACKUP_ROOT:-/var/backups/izakhono-node01}" ./backup-node01.sh

echo "[7/7] NODE01 installation complete."
echo "Control: http://127.0.0.1:8090"
echo "Registry: http://127.0.0.1:5000 (localhost only)"
echo "SUPER SEO: port 8097 after workload promotion"
