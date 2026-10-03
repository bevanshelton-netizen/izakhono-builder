# Customer deployment contract

Every customer site is an independent container attached to `izakhono-edge`.

Required inputs:
- APP_IMAGE
- APP_PORT
- domain
- health endpoint

Deployment:
1. Start the customer compose project.
2. Create `sites/<customer>.caddy` in the sovereign host.
3. Validate: `docker compose exec caddy caddy validate --config /etc/caddy/Caddyfile`
4. Reload Caddy.
5. Verify DNS and public HTTPS 200.

Do not expose a customer container port directly to the Internet. Caddy is the only public web ingress.
