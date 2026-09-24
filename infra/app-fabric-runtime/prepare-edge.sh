#!/usr/bin/env bash
set -euo pipefail
if [ "${EUID:-$(id -u)}" -ne 0 ]; then echo '[STOP] Run as root.'; exit 1; fi

HOSTNAME="${1:-}"
ORIGINS="${2:-}"
MODE="${3:-}"
BRIDGE_ORIGIN='https://bridge.izakhonoafrica.co.za'
[[ "$HOSTNAME" =~ ^[A-Za-z0-9.-]+$ ]] || { echo 'Usage: prepare-edge.sh <hostname> <comma-separated-allowed-origins> [--apply]'; exit 2; }
[ -n "$ORIGINS" ] || { echo '[STOP] At least one exact allowed browser origin is required.'; exit 2; }
case ",$ORIGINS," in
  *",$BRIDGE_ORIGIN,"*) ;;
  *) ORIGINS="$ORIGINS,$BRIDGE_ORIGIN" ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE=/opt/izakhono/secrets/app-fabric-runtime.env
SITE_DIR=/opt/izakhono/launch-stack/sites
SITE_FILE="$SITE_DIR/35-app-fabric.caddy"
STAGED=/opt/izakhono/evidence/35-app-fabric.caddy.staged
[ -f "$ENV_FILE" ] || { echo '[STOP] Run activate-node01.sh first.'; exit 1; }
[ -d "$SITE_DIR" ] || { echo '[STOP] IZAKHONO Launch Stack sites directory is missing.'; exit 1; }

sed "s/__FABRIC_HOSTNAME__/$HOSTNAME/g" "$SCRIPT_DIR/Caddyfile.snippet.template" > "$STAGED"
chmod 600 "$STAGED"

echo "[STAGED] Hostname: $HOSTNAME"
echo "[STAGED] Allowed origins: $ORIGINS"
echo "[STAGED] Caddy fragment: $STAGED"

if [ "$MODE" != '--apply' ]; then
  echo '[HOLD] No public EDGE change made. Re-run with --apply after DNS points the approved hostname at this owner-controlled EDGE.'
  exit 0
fi

cp "$STAGED" "$SITE_FILE"

python3 - "$ENV_FILE" "$ORIGINS" <<'PY'
import sys
p, origins = sys.argv[1], sys.argv[2]
rows=[]
seen=set()
for line in open(p,encoding='utf-8'):
    if '=' in line and not line.lstrip().startswith('#'):
        k=line.split('=',1)[0]
        if k in {'IZAKHONO_FABRIC_PUBLIC_INTAKE','IZAKHONO_FABRIC_ALLOWED_ORIGINS','IZAKHONO_FABRIC_ALLOW_ORIGINLESS'}:
            if k not in seen:
                if k=='IZAKHONO_FABRIC_PUBLIC_INTAKE': rows.append('IZAKHONO_FABRIC_PUBLIC_INTAKE=true\n')
                elif k=='IZAKHONO_FABRIC_ALLOWED_ORIGINS': rows.append(f'IZAKHONO_FABRIC_ALLOWED_ORIGINS={origins}\n')
                else: rows.append('IZAKHONO_FABRIC_ALLOW_ORIGINLESS=false\n')
                seen.add(k)
            continue
    rows.append(line)
for k,v in [('IZAKHONO_FABRIC_PUBLIC_INTAKE','true'),('IZAKHONO_FABRIC_ALLOWED_ORIGINS',origins),('IZAKHONO_FABRIC_ALLOW_ORIGINLESS','false')]:
    if k not in seen: rows.append(f'{k}={v}\n')
open(p,'w',encoding='utf-8').writelines(rows)
PY
chmod 600 "$ENV_FILE"

docker compose --env-file "$ENV_FILE" -f "$SCRIPT_DIR/docker-compose.yml" up -d --no-deps fabric
docker exec izakhono-caddy caddy validate --config /etc/caddy/Caddyfile
docker exec izakhono-caddy caddy reload --config /etc/caddy/Caddyfile

for i in $(seq 1 12); do
  if curl -fsS --max-time 10 "https://$HOSTNAME/health" | jq -e '.ok == true' >/dev/null 2>&1; then
    echo "[PASS] Public HTTPS APP FABRIC health verified at https://$HOSTNAME/health"
    echo '[NOTE] This proves the gateway edge only. Each platform still needs its own real event acceptance before being marked connected.'
    exit 0
  fi
  sleep 5
done

echo '[FAIL] EDGE was applied but public HTTPS health did not verify.'
echo 'Keep external platform routes unchanged and inspect DNS/TLS before retrying.'
exit 1
