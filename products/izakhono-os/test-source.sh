#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHROOT="${ROOT}/config/includes.chroot"

echo "== IZAKHONO OS source checks =="

bash "${ROOT}/verify-privacy.sh"

python3 -m py_compile \
  "${CHROOT}/usr/local/bin/izakhono-easy-center" \
  "${CHROOT}/usr/local/bin/izakhono-welcome" \
  "${CHROOT}/usr/local/bin/izakhono-privacy-center" \
  "${CHROOT}/usr/local/bin/izakhono-migrate" \
  "${ROOT}/engine/engine.py" \
  "${ROOT}/engine/server.py" \
  "${ROOT}/engine/client.py" \
  "${ROOT}/engine/test_engine.py" \
  "${CHROOT}/usr/lib/izakhono-os/engine/engine.py" \
  "${CHROOT}/usr/lib/izakhono-os/engine/server.py" \
  "${CHROOT}/usr/local/bin/izakhono-osctl"

(
  cd "${ROOT}/engine"
  python3 -m unittest -v
)

python3 - <<'PY'
from pathlib import Path
import configparser
import xml.etree.ElementTree as ET

root = Path("config/includes.chroot")
desktop_files = [
    root / "usr/share/applications/izakhono-easy-center.desktop",
    root / "usr/share/applications/izakhono-privacy-center.desktop",
    root / "usr/share/applications/izakhono-migrate.desktop",
    root / "etc/xdg/autostart/izakhono-easy-center.desktop",
    root / "etc/xdg/autostart/izakhono-welcome.desktop",
]
for path in desktop_files:
    parser = configparser.ConfigParser(interpolation=None)
    parser.read(path, encoding="utf-8")
    section = parser["Desktop Entry"]
    assert section.get("Type") == "Application", path
    assert section.get("Exec"), path
    assert section.get("Name"), path

ET.parse(root / "usr/share/izakhono-os/brand/izakhono-mark.svg")
service = (root / "etc/systemd/system/izakhono-engine.service").read_text()
assert "PrivateNetwork=yes" in service
assert "RestrictAddressFamilies=AF_UNIX" in service
assert "NoNewPrivileges=yes" in service
assert "User=izakhono" in service
print("PASS: Python, desktop entries, SVG and local-engine sandbox")
PY

grep -q 'izakhono-privacy-center' "${ROOT}/config/hooks/live/0100-izakhono-permissions.hook.chroot"
grep -q 'izakhono-migrate' "${ROOT}/config/hooks/live/0100-izakhono-permissions.hook.chroot"
grep -q 'systemctl enable izakhono-engine.service' "${ROOT}/config/hooks/live/0100-izakhono-permissions.hook.chroot"
grep -q 'ThreadingUnixStreamServer' "${ROOT}/engine/server.py"

echo "SOURCE QUALITY GATE: PASSED"
