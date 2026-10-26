# IZAKHONO MARKETING OS™

Owned-first advertising and marketing operating system for IZAKHONO.

## Product boundary

IZAKHONO MARKETING OS combines:

- AD MAKER — high-conversion creative generation
- AD INTELLIGENCE — positioning, audience, offer and hook strategy
- CREATIVE FACTORY — static, social, video, audio, print and campaign variants
- CAMPAIGN ENGINE — funnel and multi-channel campaign assembly
- SOCIAL COMMAND — scheduling, publishing and analytics adapters
- PAID ADS COMMAND — paid-media workflows and optimisation interfaces
- ANALYTICS — performance, creative scoring and attribution
- BRAND OS — brand rules, assets, offers and approved messaging
- AI MARKETING AGENT — one-workflow execution from product to campaign

## Owned-first rule

The application, data model, orchestration and customer workflow belong to IZAKHONO infrastructure. Third-party services are replaceable adapters.

Primary target: NODES01 / IZAKHONO Cloud.
Security boundary: FORTRESS.
Backups: IZAKHONO-owned backup infrastructure.

## Metricool adapter

The connected Shelton Marketing brand is represented as an external distribution/analytics adapter:

- Brand: Shelton Marketing
- Brand ID: 7233518
- Timezone: Africa/Johannesburg
- Networks currently connected: Facebook, Instagram

Metricool is not treated as the system of record.

## Runtime endpoints

- `GET /marketing-os/health`
- `GET /marketing-os/metricool`
- `POST /marketing-os/campaign`

The campaign endpoint accepts brand, product, audience, offer, objective, channel and voice and returns a structured campaign package with headline, primary copy, CTA, score, deliverables and funnel.

## Deployment

Deploy through the IZAKHONO infrastructure pipeline. Vercel may be used only as an external development/staging fallback when required; Vercel limits must never become an architectural dependency.
