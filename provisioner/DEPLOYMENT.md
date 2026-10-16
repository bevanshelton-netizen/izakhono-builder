# IZAKHONO PROVISIONER — DEPLOYMENT RUNBOOK

## Target

Run the Provisioner on IZAKHONO-controlled Linux infrastructure. The runtime must not depend on Vercel.

## Required server configuration

Set these environment variables on the server only:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- PORT=8080

Never put the service-role key in CONNECT CONTROL browser code.

## Container contract

Build a Node 20 container with the `provisioner/package.json` dependency set and `provisioner/src/server.js` runtime. Expose TCP port 8080 and place TLS/reverse proxy in front of it.

## API contract

GET /health

POST /v1/provisioning/start
```json
{"order_id":"ORDER_UUID"}
```

POST /v1/provisioning/advance
```json
{"provisioning_id":"PROVISIONING_UUID","step_key":"COVERAGE_CHECK","status":"completed","output":{}}
```

## Production requirements

1. Restrict API access to authenticated CONNECT CONTROL/service clients.
2. Add request authentication before exposing the service publicly.
3. Use HTTPS only.
4. Keep provider credentials in server-side secret storage.
5. Record every provider request and response reference without storing unnecessary sensitive payloads.
6. Never mark a service active without authoritative upstream confirmation.
7. Keep manual fallback visible as manual, never as automated activation.
