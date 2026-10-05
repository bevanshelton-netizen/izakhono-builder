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

python3 - "$SRC/izakhono-recovery.Caddyfile" "/etc/caddy/izakhono-recovery.Caddyfile" "$IZAKHONO_RECOVERY_DOMAIN" <<'PY'
from pathlib import Path
import re
import sys
src, dst, domain = sys.argv[1:]
if not re.fullmatch(r"(?=.{1,253}\Z)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}", domain):
    raise SystemExit("invalid recovery domain")
text = Path(src).read_text()
text = text.replace("{$IZAKHONO_RECOVERY_DOMAIN}", domain)
Path(dst).write_text(text)
PY

cat >/etc/izakhono/recovery-proxy.env <<EOF
IZAKHONO_RECOVERY_DOMAIN=$IZAKHONO_RECOVERY_DOMAIN
EOF
chmod 600 /etc/izakhono/recovery-proxy.env

caddy validate --config /etc/caddy/izakhono-recovery.Caddyfile --adapter caddyfile
systemctl reload caddy

echo "[PASS] Recovery HTTPS proxy configuration installed and validated."
echo "Domain: https://$IZAKHONO_RECOVERY_DOMAIN"
echo "Backend: 127.0.0.1:9697"
echo "Physical DNS, firewall reachability, ACME issuance and SMTP delivery must be verified externally."
