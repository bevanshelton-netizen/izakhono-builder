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
