#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
python3 - "$ROOT" <<'PY'
import hashlib
import pathlib
import sys

root = pathlib.Path(sys.argv[1]).resolve()
files = [
    "products/izakhono-node/wave1_deploy.py",
    "products/izakhono-node/profiles/wave1/allegro-vibez.production.json",
    "products/izakhono-node/profiles/wave1/the-chancellor.production.json",
    "infra/public-cutover/wave1-registry.json",
    "scripts/launch-stack/run-wave1-local-proof.sh",
    "scripts/launch-stack/run-allegro-local-proof.sh",
]
h = hashlib.sha256()
h.update(b"izakhono.wave1.bundle.v1\0")
for rel in sorted(files):
    path = root / rel
    if not path.is_file():
        raise SystemExit(f"missing Wave 1 bundle file: {rel}")
    h.update(rel.encode("utf-8"))
    h.update(b"\0")
    h.update(path.read_bytes())
    h.update(b"\0")
print(h.hexdigest())
PY
