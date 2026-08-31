#!/usr/bin/env bash
set -euo pipefail

require() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[FAIL] Missing required preflight input: $name" >&2
    exit 1
  fi
}

for key in IZAKHONO_APP_NAME IZAKHONO_APP_SLUG IZAKHONO_BUILD_CONTEXT IZAKHONO_DOCKERFILE IZAKHONO_CONTAINER_PORT IZAKHONO_HEALTH_PATH; do
  require "$key"
done

if [[ ! "$IZAKHONO_APP_SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo '[FAIL] Application slug is not deployment-safe.' >&2
  exit 1
fi

for path in "$IZAKHONO_BUILD_CONTEXT" "$IZAKHONO_DOCKERFILE"; do
  if [[ "$path" == /* || "$path" == *'..'* ]]; then
    echo "[FAIL] Repository path escapes the checkout: $path" >&2
    exit 1
  fi
done

if [[ ! -d "$IZAKHONO_BUILD_CONTEXT" ]]; then
  echo "[FAIL] Build context not found: $IZAKHONO_BUILD_CONTEXT" >&2
  exit 1
fi
if [[ ! -f "$IZAKHONO_DOCKERFILE" ]]; then
  echo "[FAIL] Dockerfile not found: $IZAKHONO_DOCKERFILE" >&2
  exit 1
fi
if [[ ! "$IZAKHONO_CONTAINER_PORT" =~ ^[0-9]+$ ]] || (( IZAKHONO_CONTAINER_PORT < 1 || IZAKHONO_CONTAINER_PORT > 65535 )); then
  echo '[FAIL] Container port is outside the valid range.' >&2
  exit 1
fi
if [[ "$IZAKHONO_HEALTH_PATH" != /* || "$IZAKHONO_HEALTH_PATH" == *$'\n'* || "$IZAKHONO_HEALTH_PATH" == *$'\r'* ]]; then
  echo '[FAIL] Health path is not a single absolute HTTP path.' >&2
  exit 1
fi

# Keep this gate deterministic and repository-reviewed. It never executes project-provided commands.
# Scan only the declared build context and Dockerfile for obvious credential material.
scan_targets=("$IZAKHONO_BUILD_CONTEXT" "$IZAKHONO_DOCKERFILE")
if grep -R -I -E -n \
  --exclude-dir=.git --exclude-dir=node_modules --exclude='*.lock' \
  'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|service_role[[:space:]]*[=:][[:space:]]*[^<[:space:]]+|ADMIN_SECRET[[:space:]]*=[[:space:]]*[^$<{[:space:]][^[:space:]]*|sk-[A-Za-z0-9_-]{20,}' \
  "${scan_targets[@]}"; then
  echo '[FAIL] Obvious credential material detected in the Alpha build context.' >&2
  exit 1
fi

if grep -E -n '^[[:space:]]*ADD[[:space:]]+https?://' "$IZAKHONO_DOCKERFILE"; then
  echo '[FAIL] Remote URL ADD is not allowed in the Alpha Dockerfile.' >&2
  exit 1
fi

{
  echo '# IZAKHONO PROJECT PREFLIGHT'
  echo
  echo "Application: **${IZAKHONO_APP_NAME}**"
  echo "Slug: \`${IZAKHONO_APP_SLUG}\`"
  echo "Build context: \`${IZAKHONO_BUILD_CONTEXT}\`"
  echo "Dockerfile: \`${IZAKHONO_DOCKERFILE}\`"
  echo "Health gate: \`${IZAKHONO_HEALTH_PATH}\` on port \`${IZAKHONO_CONTAINER_PORT}\`"
  echo
  echo '✅ Fixed-path preflight passed. No project-supplied shell command was executed.'
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"

echo "[PASS] IZAKHONO fixed preflight passed for ${IZAKHONO_APP_NAME}."
