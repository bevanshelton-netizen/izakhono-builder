#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Run as root." >&2
  exit 1
fi

: "${IZAKHONO_RECOVERY_DOMAIN:?Set IZAKHONO_RECOVERY_DOMAIN to the real public recovery hostname}"
command -v caddy >/dev/null || { echo "Caddy is required on the owner host." >&2; exit 2; }
command -v systemctl >/dev/null || { echo "systemctl is required." >&2; exit 2; }

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
install -d -m 0750 /etc/caddy /etc/izakhono

# Generate a concrete Caddyfile so the caddy systemd service never depends on
# an interactive shell environment or an untrusted runtime variable.
python3 - "$SRC/izakhono-recovery.Caddyfile" "/etc/caddy/izakhono-recovery.Caddyfile" "$IZAKHONO_RECOVERY_DOMAIN" <<'PY'
from pathlib import Path
import sys
src, dst, domain = sys.argv[1:]
if not domain or any(ch in domain for ch in '\n\r{}$ '):
    raise SystemExit('invalid recovery domain')
text = Path(src).read_text()
text = text.replace('{$IZAKHONO_RECOVERY_DOMAIN}', domain)
Path(dst).write_text(text)
PY

cat >/etc/izakhono/recovery-proxy.env <<EOF
IZAKHONO_RECOVERY_DOMAIN=$IZAKHONO_RECOVERY_DOMAIN
EOF
chmod 600 /etc/izakhono/recovery-proxy.env

caddy validate --config /etc/caddy/izakhono-recovery.Caddyfile --adapter caddyfile

# Keep the public Caddy service as the single TLS owner. This script does not
# open firewall ports or publish NODE/control ports.
systemctl reload caddy

echo "[PASS] Recovery HTTPS proxy configuration installed and validated."
echo "Domain: https://$IZAKHONO_RECOVERY_DOMAIN"
echo "Backend: 127.0.0.1:9697"
echo "Physical DNS, firewall reachability, ACME issuance and SMTP delivery must be verified externally."
