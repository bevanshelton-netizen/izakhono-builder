#!/usr/bin/env bash
set -euo pipefail

fail=0
for c in izakhono-caddy izakhono-postgres izakhono-core izakhono-registry; do
  status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$c" 2>/dev/null || echo missing)"
  printf '%-24s %s\n' "$c" "$status"
  [ "$status" = healthy ] || fail=1
done

shopt -s nullglob
for state in /opt/izakhono/state/*.current; do
  line="$(cat "$state")"
  IFS='|' read -r container domain port health image <<< "$line"
  if docker exec izakhono-caddy wget -q -O /dev/null "http://${container}:${port}${health}" 2>/dev/null; then
    printf '%-24s healthy (%s)\n' "$container" "$domain"
  else
    printf '%-24s UNHEALTHY (%s)\n' "$container" "$domain"
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then echo '[PASS] IZAKHONO host health is green.'; else echo '[FAIL] One or more launch services are unhealthy.'; fi
exit "$fail"
