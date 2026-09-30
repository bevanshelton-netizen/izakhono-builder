# IZAKHONO Builder branded-domain cutover

The production Worker must remain reachable on its Cloudflare `workers.dev` route while the branded DNS zone is being repaired.

Desired branded routes (do not re-enable in `wrangler.jsonc` until DNS/zone ownership is independently verified):

- `ai.izakhono.co.za`
- `legacymart.izakhono.co.za`

Cutover gate:

1. The `izakhono.co.za` zone is active in the intended Cloudflare account.
2. DNS delegation is verified.
3. The Worker is healthy on `https://izakhono-builder.bevanshelton.workers.dev`.
4. Adding the custom domain succeeds in Cloudflare.
5. HTTPS returns 200 on the branded hostname.
6. Only then may the branded route be called live.

This preserves the working public fallback and prevents a broken custom-domain registration from blocking Worker production deployment.
