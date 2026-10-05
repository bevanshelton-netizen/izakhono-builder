# NODE HTTPS Recovery Cutover

This directory contains the owner-controlled Caddy reverse-proxy boundary for IZAKHONO ID recovery.

## Security boundary

- Public traffic terminates TLS at Caddy.
- Caddy proxies only the recovery/verification routes to `127.0.0.1:9697`.
- Port 9697 is never published by this configuration.
- Node agent port 9191 and control port 9292 are not exposed here.
- Caddy rejects all other paths with `404`.
- HSTS is enabled after HTTPS is actually verified.

## Required environment

Set `IZAKHONO_RECOVERY_DOMAIN` to the real DNS name before validating/loading the Caddyfile.

Example:

```bash
export IZAKHONO_RECOVERY_DOMAIN=id.example.com
caddy validate --config products/izakhono-node/caddy/izakhono-recovery.Caddyfile --adapter caddyfile
```

The production host must have:

1. A public DNS A/AAAA record pointing the chosen hostname at the owner-controlled host.
2. TCP 80 and 443 reachable from the public internet.
3. Caddy installed and running as the host's TLS reverse proxy.
4. IZAKHONO ID recovery running on loopback port 9697.
5. `IZAKHONO_ID_PUBLIC_BASE_URL=https://<same-hostname>`.
6. Owner-controlled SMTP configured with `IZAKHONO_ID_EMAIL_MODE=smtp`.

Caddy will request/renew a certificate through ACME after DNS/network prerequisites are satisfied. The repository does not contain a certificate or private key.

## Activation procedure

```bash
sudo install -d -m 0750 /etc/caddy
sudo install -m 0644 products/izakhono-node/caddy/izakhono-recovery.Caddyfile /etc/caddy/izakhono-recovery.Caddyfile
sudo env IZAKHONO_RECOVERY_DOMAIN=id.example.com caddy validate --config /etc/caddy/izakhono-recovery.Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

Then verify from an external network:

```bash
curl -fsS https://id.example.com/healthz
curl -I https://id.example.com/forgot-password
```

Do not record the cutover as production-live until both external checks succeed and the certificate hostname matches the intended domain.
