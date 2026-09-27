#!/usr/bin/env bash
set -euo pipefail

SECRET_FILE=/opt/izakhono/secrets/app-fabric-runtime.env
REPORT_FILE=/opt/izakhono/evidence/APP-FABRIC-NODE01-REPORT.json
[ -f "$SECRET_FILE" ] || { echo '[FAIL] APP FABRIC runtime secrets are not installed.'; exit 1; }

set -a
# shellcheck disable=SC1090
source "$SECRET_FILE"
set +a

[ -n "${FLOW_ADMIN_TOKEN:-}" ] || { echo '[FAIL] FLOW_ADMIN_TOKEN is missing.'; exit 1; }
[ -n "${FLOW_INGEST_TOKEN:-}" ] || { echo '[FAIL] FLOW_INGEST_TOKEN is missing.'; exit 1; }

CRM_STATE="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' izakhono-crm 2>/dev/null || echo missing)"
REVENUE_STATE="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' izakhono-revenue 2>/dev/null || echo missing)"
TASKS_STATE="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' izakhono-tasks 2>/dev/null || echo missing)"
FLOW_STATE="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' izakhono-flow 2>/dev/null || echo missing)"
FABRIC_STATE="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' izakhono-app-fabric-gateway 2>/dev/null || echo missing)"

printf '%-32s %s\n' izakhono-crm "$CRM_STATE"
printf '%-32s %s\n' izakhono-revenue "$REVENUE_STATE"
printf '%-32s %s\n' izakhono-tasks "$TASKS_STATE"
printf '%-32s %s\n' izakhono-flow "$FLOW_STATE"
printf '%-32s %s\n' izakhono-app-fabric-gateway "$FABRIC_STATE"
[ "$CRM_STATE" = healthy ] && [ "$REVENUE_STATE" = healthy ] && [ "$TASKS_STATE" = healthy ] && [ "$FLOW_STATE" = healthy ] && [ "$FABRIC_STATE" = healthy ] || exit 1

docker exec izakhono-crm node -e "fetch('http://127.0.0.1:8080/health').then(r=>r.json()).then(v=>{if(!v.ok)process.exit(1);console.log(JSON.stringify(v))}).catch(()=>process.exit(1))" | jq .
docker exec izakhono-revenue node -e "fetch('http://127.0.0.1:8795/health').then(r=>r.json()).then(v=>{if(!v.ok||v.paymentAuthority!==false)process.exit(1);console.log(JSON.stringify(v))}).catch(()=>process.exit(1))" | jq .
docker exec izakhono-tasks python -c "import json,urllib.request; v=json.load(urllib.request.urlopen('http://127.0.0.1:9991/healthz',timeout=3)); print(json.dumps(v)); raise SystemExit(0 if v.get('ok') and v.get('flow_adapter_configured') else 1)" | jq .
docker exec izakhono-flow node -e "fetch('http://127.0.0.1:8794/health').then(r=>r.json()).then(v=>{if(!v.ok||v.service!=='izakhono-flow'||v.noTracking!==true||!v.adapterTargets.includes('izakhono-crm')||!v.adapterTargets.includes('izakhono-revenue')||!v.adapterTargets.includes('izakhono-tasks'))process.exit(1);console.log(JSON.stringify(v))}).catch(()=>process.exit(1))" | jq .
docker exec izakhono-flow node -e "fetch('http://127.0.0.1:8794/api/summary',{headers:{authorization:'Bearer '+process.env.FLOW_ADMIN_TOKEN,'x-entity-id':'izakhono-africa','x-platform-id':'runtime-selftest'}}).then(r=>r.json()).then(v=>{if(v.scope?.entity_id!=='izakhono-africa'||v.scope?.platform_id!=='runtime-selftest')process.exit(1);console.log(JSON.stringify(v))}).catch(()=>process.exit(1))" | jq .
docker exec izakhono-app-fabric-gateway node -e "fetch('http://127.0.0.1:8090/health').then(r=>r.json()).then(v=>{if(!v.ok)process.exit(1);console.log(JSON.stringify(v))}).catch(()=>process.exit(1))" | jq .
docker exec izakhono-app-fabric-gateway node -e "fetch('http://127.0.0.1:8090/api/fabric/selftest',{method:'POST',headers:{authorization:'Bearer '+process.env.IZAKHONO_FABRIC_INTERNAL_TOKEN}}).then(r=>r.json()).then(v=>{if(!v.ok||v.crm?.dry_run!==true)process.exit(1);console.log(JSON.stringify(v))}).catch(()=>process.exit(1))" | jq .

if [ -f "$REPORT_FILE" ]; then
  jq -e '.overall == "PASS_INTERNAL_OWNED" and .revenue.health == "healthy" and .tasks.health == "healthy" and .flow.health == "healthy" and .persistence.flow_backup_restore == "PASS_ISOLATED_RESTORE" and (.integration.flow_owned_adapters|length) == 3' "$REPORT_FILE" >/dev/null
  echo '[PASS] Existing activation report includes FLOW backup/restore proof.'
else
  echo '[WARN] Activation report not found; runtime health is valid but persistence evidence should be regenerated.'
fi

echo '[PASS] APP FABRIC + CRM + REVENUE + TASKS + FLOW owned internal runtime is healthy and owner-authenticated.'
