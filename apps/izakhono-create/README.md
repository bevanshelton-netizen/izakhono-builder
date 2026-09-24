# IZAKHONO CREATE

Owner-controlled visual design and mandatory portfolio marketing source for IZAKHONO AFRICA.

All portfolio advertising and marketing creative must originate here before handoff to IZAKHONO ADS.

## MVP
- canvas editor with drag-to-move layers
- premium starter templates
- text, rectangles, circles and image uploads
- social square, portrait, story and presentation sizes
- colour/position/size inspector
- undo/redo, duplicate, delete, layer ordering
- smart brief-to-layout starter
- local browser save/restore
- PNG export
- open JSON project export/import
- `izakhono.marketing.package.v1` export for controlled handoff to IZAKHONO ADS
- dependency-free static build for NODE 01
- portable to Cloudflare/Vercel as resilience routes

## NODE 01
```bash
docker build -t izakhono-create .
docker run --rm -p 8080:80 izakhono-create
```

Health check: `GET /healthz`.

## Next tranche
Accounts/team workspaces; persistent object storage; template marketplace; IZAKHONO AI Gateway for copy/image/background removal/translation; intelligent resize/reflow; video/animation timeline; PDF/SVG/MP4/GIF export; collaboration/approvals/version history; direct social publishing; iKhokha entitlements.

## Portfolio CEO Growth

IZAKHONO CREATE is also the creative front door for the Portfolio CEO Growth System. Product-specific audience, CTA, activation, retention, referral, revenue, channel and partnership contracts live in `portfolio-growth-registry.json`. CREATE must use those contracts when producing campaign packages.


## Product Media AI

`product-ai.html` adds a product-photo-to-campaign workspace with these first-class modes:

- Lifestyle shot
- 360-degree view
- Showcase
- Meta ads
- 3D billboard
- Model shot
- Catalogue
- Complete campaign pack

Power-user slash commands are supported: `/lifestyleshot`, `/360view`, `/showcase`, `/metaads`, `/3dbillboard`, `/modelshot`, `/catalogue`, and `/campaign`.

The browser sends an `izakhono.product.media.v1` request to `POST /media/api/v1/generate`. The request preserves the portfolio rule that IZAKHONO-owned infrastructure is primary and any external fallback must be reversible. The UI does not embed an outside AI vendor credential.

A live image result still requires the NODE01 media runtime (or a deliberately enabled resilience runtime) to expose that route. Until that runtime is connected, CREATE must describe the feature as installed but not yet live-generating.
