# IZAKHONO Revenue Intelligence v1

Owned-first revenue opportunity monitor for FAISReady and Allegro.

## Purpose

Run revenue monitoring from IZAKHONO-owned runtime rather than ChatGPT task quotas. The monitor is deliberately narrow: it looks for measurable product-health signals and configured opportunity feeds, scores opportunities, and exposes a machine-readable feed for the IZAKHONO command centre.

## Design

- Cloudflare Worker with Cron Trigger (preferred runtime).
- No dependency on ChatGPT scheduled tasks.
- Product targets: FAISReady and Allegro.
- Configurable signal feeds through `REVENUE_SIGNAL_FEEDS` (JSON URL list) and optional `REVENUE_ALERT_WEBHOOK`.
- Fail-closed: no claims of revenue, sales, partnerships, availability, or live deployment without evidence.
- Secrets are runtime-only; never commit tokens.

## Runtime endpoints

- `GET /health` — health/status.
- `GET /opportunities` — latest scored opportunities collected by the runtime.
- `POST /run` — authenticated manual collection trigger.
- Scheduled collection runs daily and checks configured feeds plus the public product URLs.

## Deployment

The deployment workflow is `.github/workflows/deploy-revenue-intelligence.yml`. It requires the existing production Cloudflare secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The workflow intentionally stops before deployment if those credentials are absent.
