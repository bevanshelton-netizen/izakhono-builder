# Asset routing note

IZAKHONO BUILDER uses a Worker wrapper (`src/sovereign.ts`) to provide owner-only controls and repository behavior around the static UI in `public/`.

Cloudflare Workers static assets are therefore configured with `run_worker_first: true` so requests for `/` and `/index.html` reach the sovereign Worker before the ASSETS binding serves the static page. The Worker then delegates static delivery through the existing secure application path.

This is required for owner UI augmentation such as the Add Payments repair control. API authorization and repository history rules remain unchanged.
