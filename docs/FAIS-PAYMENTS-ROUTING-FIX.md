# FAIS Payments routing fix

The owner-side Add Payments control is rendered by the sovereign Worker wrapper. Cloudflare static assets must therefore run the Worker first for root UI requests.

`wrangler.jsonc` sets `assets.run_worker_first` to `true` so `/` and `/index.html` reach `src/sovereign.ts`, which can safely augment the UI before delegating to the static ASSETS binding.

This change does not alter FAIS project data, repository history, secrets, or generated application source by itself.
