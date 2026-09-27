# IZAKHONO BUSINESS AI — NODE01 Production Runbook

## Target

Primary owned target: **NODE01** behind IZAKHONO EDGE/TLS.

Intended hostname: `businessai.izakhono.co.za`.

The application is deliberately self-contained: the customer workspace and Decision Lab execute in the browser, while the owned runtime serves one hardened HTML application plus `/health`. No behavioural analytics, advertising IDs or silent customer-data upload are required.

## Deploy on NODE01

From `products/izakhono-business-ai/owned-runtime`:

1. `docker compose build --pull`
2. `docker compose up -d`
3. Confirm local health: `curl -fsS http://127.0.0.1:8787/health`
4. Point IZAKHONO EDGE/TLS upstream for `businessai.izakhono.co.za` to `127.0.0.1:8787`.
5. Keep any verified external resilience route separate and reversible.
6. Run public acceptance:
   `node acceptance.mjs https://businessai.izakhono.co.za`

Do not change the product status to **OWNED LIVE VERIFIED** until public HTTPS, UI identity, backup, restore and rollback evidence exist.

## Backup evidence

The owned runtime is stateless. Customer business records remain local-first in the browser and can be exported from the app as JSON.

Server backup therefore consists of:

- the immutable Git commit SHA;
- the built container image digest;
- the checked-in `index.html`, `server.mjs`, Dockerfile and compose file;
- EDGE/TLS route configuration export.

Record those values in the deployment evidence log before cutover.

## Restore evidence

A restore is:

1. checkout the recorded Git commit;
2. rebuild the image;
3. start the compose service;
4. reapply the saved EDGE/TLS route;
5. run `/health` and `acceptance.mjs`.

Customer-side JSON backups remain separately exportable/importable product data; the server does not pretend to possess data it never stores.

## Rollback evidence

Keep the previously accepted image/tag available. Rollback means switching the compose service to that image and rerunning public acceptance. EDGE/TLS does not change unless the upstream itself changes.

## External resilience

A new dedicated Supabase Edge Function could not be created because the current free project has reached its function limit. A storage/static experiment returned HTTPS 200 but was served as `text/plain` and therefore was **not accepted as a live application route**. Do not label that route live.
