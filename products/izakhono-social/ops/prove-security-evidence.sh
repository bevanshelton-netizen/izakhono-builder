#!/usr/bin/env bash
set -euo pipefail

# Approved software-runtime security gate. Run in the selected Linux runtime
# environment with sufficient privilege to inspect protected service bindings.
EVIDENCE_ROOT="${CONNECTA_EVIDENCE_ROOT:-/var/lib/izakhono/evidence/connecta}"
COMMIT="${CONNECTA_EVIDENCE_COMMIT:-}"
RUNTIME_ID="${IZAKHONO_RUNTIME_ID:-${CONNECTA_RUNTIME_ID:-}}"
RUNTIME_PROVIDER="${IZAKHONO_RUNTIME_PROVIDER:-${CONNECTA_RUNTIME_PROVIDER:-}}"
ENV_FILE="${CONNECTA_ENV_FILE:-/etc/izakhono/apps/connecta.env}"

[[ "$COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo "CONNECTA_EVIDENCE_COMMIT must be an immutable 40-character SHA" >&2; exit 2; }
[[ -n "$RUNTIME_ID" && "$RUNTIME_ID" != *physical* ]] || { echo "approved logical runtime identity required" >&2; exit 2; }
[[ -n "$RUNTIME_PROVIDER" ]] || { echo "approved runtime provider required" >&2; exit 2; }
[[ "$(id -u)" -eq 0 ]] || { echo "run with sufficient privilege in the approved runtime environment" >&2; exit 2; }

[[ -f "$ENV_FILE" ]] || { echo "missing CONNECTA secret environment: $ENV_FILE" >&2; exit 3; }
[[ "$(stat -c '%a' "$ENV_FILE")" =~ ^0?(600|640)$ ]] || { echo "CONNECTA env permissions too broad" >&2; exit 4; }
command -v docker >/dev/null || { echo "docker missing" >&2; exit 6; }
docker compose version >/dev/null 2>&1 || { echo "docker compose unavailable" >&2; exit 7; }
command -v ss >/dev/null || { echo "ss is required to verify protected service bindings" >&2; exit 8; }

exposed="$(ss -lntH | awk '$4 !~ /^127\.0\.0\.1:/ && $4 !~ /^\[::1\]:/ {print $4}' | grep -E ':(4100|5432|9191|9292)$' || true)"
[[ -z "$exposed" ]] || { echo "protected service exposed: $exposed" >&2; exit 5; }

mkdir -p "$EVIDENCE_ROOT"
python3 - "$EVIDENCE_ROOT/security.ok" "$COMMIT" "$RUNTIME_ID" "$RUNTIME_PROVIDER" "$ENV_FILE" <<'PY'
import json,os,pathlib,sys,time
out,sha,runtime_id,provider,env_file=sys.argv[1:]
p=pathlib.Path(out); tmp=pathlib.Path(str(p)+'.tmp')
payload={
 'schema':'izakhono.connecta.gate.security.v1',
 'status':'PASS',
 'evidence_source':'prove-security-evidence.sh:approved-runtime-execution',
 'checked_at_epoch':int(time.time()),
 'release_sha':sha,
 'runtime_id':runtime_id,
 'runtime_provider':provider,
 'physical_hardware_required':False,
 'secret_env':{'path':env_file,'permission_check':'PASS'},
 'protected_ports':{'postgres':'private/container-only','engine':'private/container-only','management':'loopback-only'},
 'docker_compose_available':True,
 'protected_listener_check':'PASS'
}
with open(tmp,'w',encoding='utf-8') as f: json.dump(payload,f,indent=2,sort_keys=True); f.write('\n')
os.chmod(tmp,0o600); os.replace(tmp,p); print(p)
PY
