#!/usr/bin/env bash
set -euo pipefail
if ! command -v node >/dev/null 2>&1; then echo "Node.js is required" >&2; exit 1; fi
if [ ! -d node_modules ]; then npm install; fi

echo "1/5 Authenticating with Cloudflare if required..."
npx wrangler whoami >/dev/null 2>&1 || npx wrangler login

echo "2/5 First deploy and automatic D1 provisioning..."
npx wrangler deploy

echo "3/5 Applying builder database migrations..."
npx wrangler d1 migrations apply DB --remote

echo "4/5 Creating builder admin secret..."
ADMIN_SECRET="$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")"
printf '%s' "$ADMIN_SECRET" | npx wrangler secret put ADMIN_SECRET >/dev/null
(umask 077; printf '%s\n' "$ADMIN_SECRET" > .local-admin-secret)

echo "5/5 Final deploy..."
npx wrangler deploy

echo
echo "IZAKHONO BUILDER is deployed."
echo "Private builder admin secret saved locally to .local-admin-secret."
echo "Never commit or share that file."
echo "Open the Worker URL to use the visual application factory."
