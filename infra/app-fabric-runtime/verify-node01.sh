#!/usr/bin/env bash
set -euo pipefail
SECRET_FILE=/opt/izakhono/secrets/app-fabric-runtime.env
[ -f "$SECRET_FILE" ] || { echo '[FAIL] APP FABRIC runtime secrets are not installed.'; exit 1; }
set -a
# shellcheck disable=SC1090
source "$SECRET_FILE"
set +a

CRM_STATE="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' izakhono-crm 2>/dev/null || echo missing)"
FABRIC_STATE="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' izakhono-app-fabric-gateway 2>/dev/null || echo missing)"
printf '%-32s %s\n' izakhono-crm "$CRM_STATE"
printf '%-32s %s\n' izakhono-app-fabric-gateway "$FABRIC_STATE"
[ "$CRM_STATE" = healthy ] && [ "$FABRIC_STATE" = healthy ] || exit 1

curl -fsS http://127.0.0.1:18080/health | jq .
curl -fsS http://127.0.0.1:18090/health | jq .
curl -fsS -X POST -H "Authorization: Bearer $IZAKHONO_FABRIC_INTERNAL_TOKEN" http://127.0.0.1:18090/api/fabric/selftest | jq -e '.ok == true and .crm.dry_run == true'

echo '[PASS] APP FABRIC owned internal runtime and non-writing CRM integration are healthy.'
