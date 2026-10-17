#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHROOT="${ROOT}/config/includes.chroot"

echo "== IZAKHONO OS source checks =="

bash "${ROOT}/verify-privacy.sh"

python3 -m py_compile   "${CHROOT}/usr/local/bin/izakhono-easy-center"   "${CHROOT}/usr/local/bin/izakhono-welcome"   "${CHROOT}/usr/local/bin/izakhono-privacy-center"   "${CHROOT}/usr/local/bin/izakhono-migrate"

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
print("PASS: Python, desktop entries and SVG parse")
PY

grep -q 'izakhono-privacy-center' "${ROOT}/config/hooks/live/0100-izakhono-permissions.hook.chroot"
grep -q 'izakhono-migrate' "${ROOT}/config/hooks/live/0100-izakhono-permissions.hook.chroot"

echo "SOURCE QUALITY GATE: PASSED"
