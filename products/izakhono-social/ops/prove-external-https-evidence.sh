#!/usr/bin/env bash
set -euo pipefail

# Independent external HTTPS acceptance gate. Run from a machine outside the
# CONNECTA NODE/EDGE network. This script never changes DNS or routing.
EVIDENCE_ROOT="${CONNECTA_EVIDENCE_ROOT:-/var/lib/izakhono/evidence/connecta}"
COMMIT="${CONNECTA_EVIDENCE_COMMIT:-$(git rev-parse HEAD 2>/dev/null || true)}"
URL="${CONNECTA_EXTERNAL_HTTPS_URL:-}"
EXPECTED_HOST="${CONNECTA_EXTERNAL_HTTPS_HOST:-}"

[[ -n "$COMMIT" && "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo "immutable commit required" >&2; exit 2; }
[[ -n "$URL" && "$URL" =~ ^https:// ]] || { echo "CONNECTA_EXTERNAL_HTTPS_URL must be HTTPS" >&2; exit 3; }
[[ -n "$EXPECTED_HOST" ]] || { echo "CONNECTA_EXTERNAL_HTTPS_HOST required" >&2; exit 3; }
command -v curl >/dev/null || { echo "curl missing" >&2; exit 4; }
command -v python3 >/dev/null || { echo "python3 missing" >&2; exit 4; }

headers="$(mktemp)"
body="$(mktemp)"
trap 'rm -f "$headers" "$body"' EXIT
curl --fail --silent --show-error --location --max-time 20 --connect-timeout 8 \
  --dump-header "$headers" --output "$body" "$URL/health"

status="$(awk 'NR==1 {print $2}' "$headers")"
[[ "$status" == "200" ]] || { echo "external HTTPS status was $status" >&2; exit 5; }

python3 - "$body" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    data=json.load(f)
if data.get('ok') is not True:
    raise SystemExit('external health did not report ok=true')
PY

mkdir -p "$EVIDENCE_ROOT"
python3 - "$EVIDENCE_ROOT/external-https.json" "$COMMIT" "$URL" "$EXPECTED_HOST" <<'PY'
import json, pathlib, sys, time
out, commit, url, host = sys.argv[1:]
p = pathlib.Path(out)
tmp = p.with_suffix('.json.tmp')
payload = {
  'schema': 'izakhono.connecta.gate.external-https.v1',
  'status': 'PASS',
  'evidence_source': 'prove-external-https-evidence.sh:independent-external-execution',
  'checked_at_epoch': int(time.time()),
  'immutable_commit': commit,
  'url': url,
  'expected_host': host,
  'http_status': 200,
  'health_ok': True,
  'external_execution_required': True
}
with open(tmp, 'w', encoding='utf-8') as f:
    json.dump(payload, f, indent=2, sort_keys=True); f.write('\n')
import os
os.chmod(tmp, 0o600)
os.replace(tmp, p)
print(p)
PY
