# IZAKHONO Growth Engine

Owned-first client-acquisition and growth orchestration for the IZAKHONO portfolio.

This is the portfolio's original Zeely-class equivalent. It does **not** copy Zeely branding, code or proprietary workflows. It composes IZAKHONO's existing owned systems into one operating layer:

`Product -> Growth Engine -> IZAKHONO CREATE -> IZAKHONO ADS -> audience -> lead/sale -> IZAKHONO CRM -> IZAKHONO REVENUE`

## What v0.3 does

- Portfolio campaign command centre.\n- Diagnosis-first 6-question Growth Check with business-stage segmentation, lead priority scoring and three-action prescriptions.\n- Next-step funnel for Start Now, WhatsApp contact, strategy session or proposal requests.
- Product-specific campaign pack generation.
- Verified live-product launch packs with WhatsApp, email, LinkedIn, organic-social and short-video variants.
- Direct routing from approved campaign pages to the verified live product destination; gated products remain enquiry-only.
- Multi-channel copy variants for WhatsApp, email, social, short video and B2B outreach.
- Landing/enquiry pages for approved offers.
- Consent-aware lead capture without advertising IDs, cookies or behavioural tracking.
- Server-side lead queue with CRM handoff adapter.
- Aggregate campaign and lead dashboard.
- Explicit conversion gates: campaigns cannot be marked ready for public distribution when their destination is unverified.
- Owned-first Docker package for NODE01; external deployment remains a reversible resilience option.

## Safety and commercial rules

- IZAKHONO CREATE remains the creative source of record.
- IZAKHONO ADS remains the distribution/spend control layer.
- No campaign spend is authorised by this service.
- No automated cold-spam blasting.
- No misleading claims, fake urgency or fabricated testimonials.
- Regulated products stay compliance-gated.
- No behavioural surveillance, tracking cookies or advertising IDs.
- Public-live status requires independent HTTPS and end-to-end conversion verification.

## API

- `GET /health`
- `GET /api/dashboard`
- `GET /api/campaigns`
- `GET /api/campaigns/:slug/launch-pack`
- `POST /api/campaigns/generate`
- `POST /api/public/lead`\n- `POST /api/public/growth-diagnostic`\n- `POST /api/public/growth-diagnostic/lead`\n- `GET /growth-check/`
- `GET /api/leads` (admin token)
- `POST /api/leads/:id/push-crm` (admin token)
- `GET /l/:slug` generated landing/enquiry page

Write/admin calls use `Authorization: Bearer $GROWTH_ADMIN_TOKEN`.

## NODE01

```bash
docker build -t izakhono/growth-engine:0.2.0 products/izakhono-growth-engine
docker run -d --name izakhono-growth-engine --restart unless-stopped \
  -p 127.0.0.1:8096:8096 \
  -e GROWTH_ADMIN_TOKEN='replace-me' \
  -e GROWTH_DATA_DIR=/data \
  -v izakhono-growth-data:/data \
  izakhono/growth-engine:0.2.0
```

Put EDGE/TLS in front of the service. Do not expose the container port directly to the public internet.
