#!/usr/bin/env bash
set -euo pipefail

# Independent HTTPS acceptance gate. Run from a network outside the selected
# CONNECTA runtime/EDGE. This script never changes DNS or routing.
EVIDENCE_ROOT="${CONNECTA_EVIDENCE_ROOT:-/var/lib/izakhono/evidence/connecta}"
COMMIT="${CONNECTA_EVIDENCE_COMMIT:-}"
RUNTIME_ID="${IZAKHONO_RUNTIME_ID:-${CONNECTA_RUNTIME_ID:-}}"
RUNTIME_PROVIDER="${IZAKHONO_RUNTIME_PROVIDER:-${CONNECTA_RUNTIME_PROVIDER:-}}"
URL="${CONNECTA_EXTERNAL_HTTPS_URL:-}"
EXPECTED_HOST="${CONNECTA_EXTERNAL_HTTPS_HOST:-}"

[[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo "immutable commit required" >&2; exit 2; }
[[ -n "$RUNTIME_ID" && "$RUNTIME_ID" != *physical* ]] || { echo "approved logical runtime identity required" >&2; exit 2; }
[[ -n "$RUNTIME_PROVIDER" ]] || { echo "approved runtime provider required" >&2; exit 2; }
[[ -n "$URL" && "$URL" =~ ^https:// ]] || { echo "CONNECTA_EXTERNAL_HTTPS_URL must be HTTPS" >&2; exit 3; }
[[ -n "$EXPECTED_HOST" ]] || { echo "CONNECTA_EXTERNAL_HTTPS_HOST required" >&2; exit 3; }
command -v curl >/dev/null || { echo "curl missing" >&2; exit 4; }
command -v python3 >/dev/null || { echo "python3 missing" >&2; exit 4; }

python3 - "$URL" "$EXPECTED_HOST" <<'PY'
from urllib.parse import urlparse
import sys
u=urlparse(sys.argv[1])
if u.scheme != 'https' or u.hostname != sys.argv[2] or u.username or u.password or u.fragment:
    raise SystemExit('URL must use the exact expected HTTPS host and contain no credentials or fragment')
PY

headers="$(mktemp)"; body="$(mktemp)"; trap 'rm -f "$headers" "$body"' EXIT
curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 --max-time 20 --connect-timeout 8 \
  --dump-header "$headers" --output "$body" "$URL/health"
status="$(awk 'NR==1 {print $2}' "$headers")"
[[ "$status" == "200" ]] || { echo "external HTTPS status was $status" >&2; exit 5; }
python3 - "$body" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f: data=json.load(f)
if data.get('ok') is not True: raise SystemExit('external health did not report ok=true')
PY

mkdir -p "$EVIDENCE_ROOT"
python3 - "$EVIDENCE_ROOT/external_https.ok" "$COMMIT" "$RUNTIME_ID" "$RUNTIME_PROVIDER" "$URL" "$EXPECTED_HOST" <<'PY'
import json,os,pathlib,sys,time
out,sha,runtime_id,provider,url,host=sys.argv[1:]
p=pathlib.Path(out); tmp=pathlib.Path(str(p)+'.tmp')
payload={
 'schema':'izakhono.connecta.gate.external-https.v1',
 'status':'PASS',
 'evidence_source':'prove-external-https-evidence.sh:independent-external-execution',
 'checked_at_epoch':int(time.time()),
 'release_sha':sha,
 'runtime_id':runtime_id,
 'runtime_provider':provider,
 'physical_hardware_required':False,
 'url':url,
 'expected_host':host,
 'http_status':200,
 'health_ok':True,
 'external_execution_required':True
}
with open(tmp,'w',encoding='utf-8') as f: json.dump(payload,f,indent=2,sort_keys=True); f.write('\n')
os.chmod(tmp,0o600); os.replace(tmp,p); print(p)
PY
