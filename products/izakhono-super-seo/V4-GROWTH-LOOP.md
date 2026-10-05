# IZAKHONO SUPER SEO V4 — Search → Content → Leads → Revenue

V4 turns the V3 search-opportunity layer into an approval-gated acquisition loop.

## Flow

1. **Search Intelligence** identifies observable opportunities.
2. **Content Factory** converts the highest-value opportunities into structured briefs.
3. **Approval gate** prevents automatic mass publication.
4. **Landing/content pages** carry explicit conversion CTAs.
5. **Lead capture** records a `lead_submit` event.
6. **Revenue attribution** records downstream sale/revenue events in ZAR or another declared currency.
7. **Measurement** can connect keyword, landing page, campaign and revenue data without inventing metrics.

## V4 modules

- `growth-loop.mjs` — content briefs, growth plans, attribution events and tracking links.
- `tests/growth-loop.test.mjs` — deterministic unit coverage.

## Safety / quality rules

- No automated backlink exchange.
- No paid ranking links without appropriate disclosure/`rel` attributes.
- No mass low-value AI page generation.
- Human/product-value approval is required before publication.
- Search volume, ranking, traffic and revenue are never fabricated; they must come from an actual provider or recorded event.
- Attribution events validate revenue values and keep source/campaign/keyword context explicit.

## Next integration

Wire the V4 module into the SUPER SEO server/UI so an approved opportunity can move from `/api/search` into a brief, then into a customer-facing landing page and lead/revenue event pipeline.
