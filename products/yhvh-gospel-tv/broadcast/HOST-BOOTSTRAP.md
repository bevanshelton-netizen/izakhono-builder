# YHVH GOSPEL TV — IZAKHONO Host Bootstrap

## Purpose

This is the provider-neutral activation procedure for the persistent Linux/Docker host that will run the YHVH GOSPEL TV broadcast engine.

## Host baseline

- Linux LTS host under IZAKHONO control or an authorized infrastructure provider.
- Docker Engine + Docker Compose plugin.
- Persistent disk for `content-vault`, `hls`, and `data`.
- Stable public HTTPS ingress to port 8787, preferably behind a reverse proxy/TLS terminator.
- Firewall: expose only required HTTPS ingress; do not expose the control API directly to the public internet.
- Automatic restart enabled.
- Monitoring and disk-space alerts enabled.
- Secrets supplied through the host secret/environment mechanism, never Git.

## Installation

```bash
mkdir -p /opt/izakhono/yhvh-gospel-tv
cd /opt/izakhono/yhvh-gospel-tv

git clone https://github.com/bevanshelton-netizen/izakhono-builder.git repo
cd repo/products/yhvh-gospel-tv/broadcast

cp .env.example .env
chmod 600 .env
# Edit .env and insert a strong YHVH_CONTROL_TOKEN.

docker compose -f docker-compose.production.yml up -d --build
```

## Mandatory pre-live checks

1. `docker compose ps` shows the service healthy.
2. `/health` returns the expected YHVH runtime identity.
3. `/api/status` reports the broadcast runtime.
4. Content exists physically inside the configured content vault.
5. Every intended item is `READY`, with rights `CLEAR`, QC `PASS`, and territory authorization.
6. Owner control token is stored outside Git.
7. Encoder is started only after the content gate passes.
8. HLS playlist is independently retrievable from outside the host.
9. A separate playback client successfully plays the stream.
10. Only then may the authorized route be marked `LIVE`.

## Security

- Never commit `.env`, stream keys, passwords, certificates, or private keys.
- Never bypass the rights or territory gates to make the station appear live.
- Do not expose `/api/control/*` without authentication and network protection.
- Rotate the control token if it is disclosed.
- Keep operating-system, Docker, reverse-proxy and application patches current.

## Recovery

If the encoder fails, keep the public status non-LIVE until an authorized stream is restored and independently verified. Use the documented failover route only where the replacement route is independently authorized and rights-cleared.
