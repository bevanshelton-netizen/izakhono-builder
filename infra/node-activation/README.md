# IZAKHONO NODE01 PHYSICAL ACTIVATION

This package is the first physical gate for the provider-independent IZAKHONO runtime.

## Run on NODE01

```bash
sudo bash NODE01-PREFLIGHT.sh
```

The gate checks:

- root administration
- Ubuntu 24.04 LTS or equivalent
- Docker Engine and reachable daemon
- Docker Compose
- at least 40 GiB free root storage
- global IPv4, with IPv6 preferred
- local availability of TCP 22/80/443
- outbound HTTPS/public IPv4 discovery

A PASS means the host is suitable for the next activation stage. It does **not** mean IZAKHONO production is live.

## Next physical activation

1. Run this preflight on the real controlled NODE01.
2. Install/stage the owned runtime package.
3. Start the production Compose stack.
4. Verify Caddy, PostgreSQL, MinIO and Valkey health.
5. Bind approved domains and TLS.
6. Execute external acceptance tests.
7. Configure independent backups and complete restore rehearsal.
8. Add NODE02/NODE03/NODE04 for resilience.

Production status must remain `NOT LIVE` until independent acceptance evidence exists.
