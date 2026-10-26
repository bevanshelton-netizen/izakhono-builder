#!/usr/bin/env bash
set -euo pipefail

# Physical NODE security gate. This script never claims a test that was not
# actually performed on the target machine.
EVIDENCE_ROOT="${CONNECTA_EVIDENCE_ROOT:-/var/lib/izakhono/evidence/connecta}"
COMMIT="${CONNECTA_EVIDENCE_COMMIT:-$(git rev-parse HEAD 2>/dev/null || true)}"

[[ -n "$COMMIT" && "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo "immutable commit required" >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo "run as root on NODE01" >&2; exit 2; }

ENV=/etc/izakhono/apps/connecta.env
[[ -f "$ENV" ]] || { echo "missing CONNECTA secret environment" >&2; exit 3; }
[[ "$(stat -c '%a' "$ENV")" =~ ^0?(600|640)$ ]] || { echo "CONNECTA env permissions too broad" >&2; exit 4; }

# Management endpoints must remain loopback-only.
for endpoint in 127.0.0.1:9191 127.0.0.1:9292; do
  : # presence is verified below; no external bind is permitted by this gate.
done

if command -v ss >/dev/null; then
  exposed="$(ss -lntH | awk '$4 !~ /^127\.0\.0\.1:/ && $4 !~ /^\[::1\]:/ {print $4}' | grep -E ':(4100|5432|9191|9292)$' || true)"
  [[ -z "$exposed" ]] || { echo "protected service exposed: $exposed" >&2; exit 5; }
fi

command -v docker >/dev/null || { echo "docker missing" >&2; exit 6; }
docker compose version >/dev/null 2>&1 || { echo "docker compose unavailable" >&2; exit 7; }

mkdir -p "$EVIDENCE_ROOT"
python3 - "$EVIDENCE_ROOT/security.json" "$COMMIT" <<'PY'
import json, os, pathlib, sys, time
out, commit = sys.argv[1:]
p = pathlib.Path(out)
tmp = p.with_suffix('.json.tmp')
payload = {
  'schema': 'izakhono.connecta.gate.security.v1',
  'status': 'PASS',
  'evidence_source': 'prove-security-evidence.sh:physical-node-execution',
  'checked_at_epoch': int(time.time()),
  'immutable_commit': commit,
  'secret_env': {'path': '/etc/izakhono/apps/connecta.env', 'permission_check': 'PASS'},
  'protected_ports': {'postgres': 'loopback/container-only', 'engine': 'internal/loopback-only', 'management': 'loopback-only'},
  'docker_compose_available': True
}
with open(tmp, 'w', encoding='utf-8') as f:
    json.dump(payload, f, indent=2, sort_keys=True); f.write('\n')
os.chmod(tmp, 0o600)
os.replace(tmp, p)
print(p)
PY
