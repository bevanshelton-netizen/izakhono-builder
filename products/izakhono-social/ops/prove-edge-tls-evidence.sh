#!/usr/bin/env bash
set -euo pipefail

# Physical EDGE/TLS gate. This script proves an already-configured public route;
# it never changes DNS, certificates, firewall rules, or routing.
EVIDENCE_ROOT="${CONNECTA_EVIDENCE_ROOT:-/var/lib/izakhono/evidence/connecta}"
COMMIT="${CONNECTA_EVIDENCE_COMMIT:-$(git rev-parse HEAD 2>/dev/null || true)}"
PUBLIC_URL="${CONNECTA_PUBLIC_URL:-}"
EXPECTED_HOST="${CONNECTA_PUBLIC_HOST:-}"

[[ -n "$COMMIT" && "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo "immutable commit required" >&2; exit 2; }
[[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || exit 2
[[ -n "$PUBLIC_URL" && "$PUBLIC_URL" =~ ^https://[^/]+/health/?$ ]] || { echo "CONNECTA_PUBLIC_URL must be an HTTPS /health URL" >&2; exit 3; }
[[ -n "$EXPECTED_HOST" ]] || { echo "CONNECTA_PUBLIC_HOST is required" >&2; exit 3; }
command -v curl >/dev/null || { echo "curl is required" >&2; exit 4; }
command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 4; }
command -v python3 >/dev/null || { echo "python3 is required" >&2; exit 4; }

mkdir -p "$EVIDENCE_ROOT"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

curl -fsS --max-time 20 --proto '=https' --tlsv1.2 "$PUBLIC_URL" > "$TMP/health.json" || { echo "public HTTPS health failed" >&2; exit 5; }
python3 - "$TMP/health.json" <<'PY'
import json,sys
with open(sys.argv[1],encoding='utf-8') as f: d=json.load(f)
if not d.get('ok'):
    raise SystemExit('public health returned ok=false')
PY

HOST="$(python3 - "$PUBLIC_URL" <<'PY'
from urllib.parse import urlparse
import sys
print(urlparse(sys.argv[1]).hostname)
PY
)"
[[ "$HOST" == "$EXPECTED_HOST" ]] || { echo "public host mismatch: $HOST" >&2; exit 6; }

CERT="$TMP/cert.pem"
printf '' | openssl s_client -connect "$HOST:443" -servername "$HOST" -verify_hostname "$HOST" -verify_return_error -tls1_2 2>"$TMP/tls.err" | openssl x509 -out "$CERT" >/dev/null 2>&1 || { cat "$TMP/tls.err" >&2; exit 7; }

NOT_AFTER="$(openssl x509 -in "$CERT" -noout -enddate | cut -d= -f2-)"
python3 - "$NOT_AFTER" <<'PY'
from datetime import datetime, timezone
import sys
expiry=datetime.strptime(sys.argv[1],'%b %d %H:%M:%S %Y %Z').replace(tzinfo=timezone.utc)
if expiry.timestamp() <= __import__('time').time()+86400:
    raise SystemExit('TLS certificate expires within 24 hours')
PY

python3 - "$EVIDENCE_ROOT/edge-tls.json" "$COMMIT" "$PUBLIC_URL" "$HOST" "$NOT_AFTER" <<'PY'
import json,os,pathlib,sys,time
out,commit,url,host,expiry=sys.argv[1:]
p=pathlib.Path(out); tmp=pathlib.Path(str(p)+'.tmp')
payload={
 'schema':'izakhono.connecta.gate.edge-tls.v1',
 'status':'PASS',
 'evidence_source':'prove-edge-tls-evidence.sh:physical-node-execution',
 'checked_at_epoch':int(time.time()),
 'immutable_commit':commit,
 'public_health_url':url,
 'hostname':host,
 'https_health':'PASS',
 'tls_hostname_verification':'PASS',
 'certificate_not_after':expiry,
 'dns_or_edge_configuration':'observed-only; no changes made'
}
with open(tmp,'w',encoding='utf-8') as f: json.dump(payload,f,indent=2,sort_keys=True); f.write('\n')
os.chmod(tmp,0o600); os.replace(tmp,p)
print(p)
PY

echo "CONNECTA_EDGE_TLS_EVIDENCE=PASS"
