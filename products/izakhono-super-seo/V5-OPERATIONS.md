# IZAKHONO SUPER SEO V5 — Live Operations

V5 turns observed search opportunities into an executable, approval-gated growth queue.

## Flow

`/api/search` → opportunity queue → priority → target URL → content brief → CTA → attribution campaign → human review → publish manifest.

The dashboard exposes this as **Live Growth Queue**.

## Approval boundary

Generated work remains `needs_review`. Publication is never implied by opportunity score. A human/product-value review is required before publication.

Approved operations can be represented by `buildManifest()` for a downstream publisher. The manifest contains only explicitly approved operations.

## Attribution

Each operation receives stable first-party event names:

- `lead_created`
- `customer_created`
- `revenue_recorded`

The engine never invents leads, customers, rankings, search volume or revenue.

## Guardrails

- No automated backlink exchanges.
- No paid ranking links without appropriate qualification.
- No mass low-value AI pages.
- No automatic publication without approval.
- Search metrics appear only when supplied by a configured search provider.
