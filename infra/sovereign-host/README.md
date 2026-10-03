# IZAKHONO Sovereign Host

This stack turns NODE01 into the primary IZAKHONO hosting node.

## Services
- Caddy: reverse proxy and automatic TLS
- PostgreSQL: shared durable database service
- Valkey: queues/cache
- MinIO: S3-compatible object storage
- Prometheus: metrics
- Grafana: dashboards
- Node Exporter: host metrics

Customer applications are deployed as independent containers on the `izakhono-edge` network. Each app remains independently deployable.

## Owned-first routing
Primary path:
DNS -> public IPv4/IPv6 -> router/NAT -> NODE01 -> Caddy -> customer container

Resilience path:
DNS switch or optional tunnel/CDN -> NODE01 or external customer deployment.

The external route is never required to build or run an application locally.

## First activation on NODE01
1. Install Docker Desktop or Docker Engine with Compose.
2. Copy `.env.example` to `.env` and replace every CHANGE_ME value.
3. Ensure TCP 80 and 443 can reach NODE01 from the Internet.
4. Run `BOOTSTRAP-NODE01.ps1` as Administrator.
5. Run `VERIFY-NODE01.ps1`.
6. Point a test domain A/AAAA record to the public address.
7. Deploy a customer app using `customer-template/compose.yaml`.

## Hard production gates
A site is not LIVE until:
- container health is healthy
- Caddy route is loaded
- public DNS resolves
- HTTPS returns 200
- certificate is valid
- restart survives a NODE01 reboot
- backup job has completed at least once

## Email
Mail is deliberately isolated from the web host. Use the existing `infra/mail-stack` as the mail plane so a mail fault cannot take down customer websites. Web and mail share DNS policy, not process lifecycle.
