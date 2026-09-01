#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo 'Run as root (sudo).'
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

if [ ! -r /etc/os-release ]; then
  echo '[FAIL] Cannot identify Linux distribution.'
  exit 1
fi
# shellcheck disable=SC1091
source /etc/os-release
case "${ID:-}" in
  ubuntu|debian) ;;
  *)
    echo "[FAIL] First-host installer currently supports Ubuntu or Debian only (found ${ID:-unknown})."
    exit 1
    ;;
esac

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64|aarch64|arm64) ;;
  *)
    echo "[FAIL] Unsupported CPU architecture: $ARCH"
    exit 1
    ;;
esac

MEM_KB="$(awk '/MemTotal:/ {print $2}' /proc/meminfo)"
if [ "${MEM_KB:-0}" -lt 1900000 ]; then
  echo '[FAIL] At least 2 GB RAM is required for the first host.'
  exit 1
fi
if [ "$MEM_KB" -lt 3900000 ]; then
  echo '[WARN] Less than 4 GB RAM detected. Suitable for an initial low-traffic host, not a large multi-app cluster.'
fi

FREE_KB="$(df -Pk / | awk 'NR==2 {print $4}')"
if [ "${FREE_KB:-0}" -lt 8000000 ]; then
  echo '[FAIL] At least 8 GB free root filesystem space is required before installation.'
  exit 1
fi

cat <<EOF
IZAKHONO FIRST HOST
OS=${PRETTY_NAME:-$ID}
ARCH=$ARCH
RAM_MB=$((MEM_KB / 1024))
ROOT_FREE_MB=$((FREE_KB / 1024))
EOF

echo 'Installing hardened host prerequisites...'
bash "$SCRIPT_DIR/bootstrap-host.sh" --harden

echo 'Starting the owner-controlled Launch Stack...'
bash "$SCRIPT_DIR/init-stack.sh"

echo 'Installing autonomous health, backup and restore-rehearsal timers...'
bash "$SCRIPT_DIR/install-automation.sh"

echo 'Running first host health proof...'
bash /opt/izakhono/bin/health-check.sh

if [ -d /srv/izakhono/repos ]; then
  echo 'Creating portable source snapshots for repositories already present on this host...'
  bash /opt/izakhono/bin/snapshot-sources.sh /srv/izakhono/repos || {
    echo '[WARN] Source snapshot did not complete. Runtime installation remains healthy; inspect repository state before launch.'
  }
fi

cat <<'EOF'

[PASS] IZAKHONO first host foundation is installed and healthy.

The host now owns:
- HTTPS ingress
- Docker application runtime
- PostgreSQL
- local OCI registry
- rollback state
- fixed launch tools
- recurring health checks
- daily backups
- weekly isolated restore rehearsals

No public application is claimed live yet. Before a commercial launch, point the chosen domain to this host and run:

  sudo /opt/izakhono/bin/launch-project.sh /srv/izakhono/repos/<project> <domain> [--with-db]

That command fails closed unless the real public HTTPS health gate passes. Projects that declare a reviewed commercial-readiness gate must also pass it before promotion.
EOF
