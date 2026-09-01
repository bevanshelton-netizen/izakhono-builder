#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then echo 'Run as root (sudo).'; exit 1; fi
PROJECT="${1:-}"
MODE="${2:-}"
[[ "$PROJECT" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] && [ "${#PROJECT}" -le 64 ] || {
  echo 'Usage: provision-core-project.sh <project-slug> [--allow-signup]'
  exit 2
}
ALLOW=false
[ "$MODE" = '--allow-signup' ] && ALLOW=true
[ -z "$MODE" ] || [ "$MODE" = '--allow-signup' ] || { echo 'Unknown option.'; exit 2; }

status="$(docker inspect -f '{{.State.Health.Status}}' izakhono-core 2>/dev/null || true)"
[ "$status" = healthy ] || { echo 'IZAKHONO Core is not healthy.'; exit 1; }

STATE_DIR=/opt/izakhono/state
OUT="$STATE_DIR/core-project-${PROJECT}.json"
if [ -f "$OUT" ]; then
  echo "Project state already exists at $OUT; refusing silent project-key rotation."
  exit 1
fi
mkdir -p "$STATE_DIR"
umask 077

response="$(docker exec \
  -e CORE_PROJECT="$PROJECT" \
  -e CORE_ALLOW_SIGNUP="$ALLOW" \
  izakhono-core node --input-type=module -e '
    const body={project:process.env.CORE_PROJECT,allow_signup:process.env.CORE_ALLOW_SIGNUP==="true"};
    const response=await fetch("http://127.0.0.1:8787/v1/admin/projects",{
      method:"POST",
      headers:{Authorization:`Bearer ${process.env.IZAKHONO_CORE_ADMIN_TOKEN}`,"Content-Type":"application/json"},
      body:JSON.stringify(body)
    });
    const text=await response.text();
    if(!response.ok){console.error(text);process.exit(1)}
    process.stdout.write(text)
  ' )"

printf '%s\n' "$response" > "$OUT"
chmod 600 "$OUT"

PUBLIC_KEY="$(printf '%s' "$response" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).public_key||""))')"
[ -n "$PUBLIC_KEY" ] || { echo 'Core returned no public project key.'; exit 1; }

echo "[PASS] IZAKHONO Core project provisioned: $PROJECT"
echo "Public project key: $PUBLIC_KEY"
echo "Owner-only project record: $OUT"
if [ "$ALLOW" = true ]; then echo 'Password signup is enabled for this project.'; else echo 'Password signup remains disabled.'; fi
