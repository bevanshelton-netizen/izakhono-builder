# I-CONNECT — IZAKHONO-Owned Deployment

This directory is the portable production deployment layer for I-CONNECT. Vercel is not required.

## Runtime

- Docker + Docker Compose
- Node 24 application container
- Caddy edge reverse proxy
- Automatic HTTPS for the approved hostname
- Persistent Caddy certificate/config volumes
- Application health checks and automatic container restart

## Deployment

1. Provision an IZAKHONO-controlled Linux VM/server with Docker Engine and Compose.
2. Clone this repository.
3. Copy `deploy/.env.example` to `deploy/.env` and set the protected production values.
4. Set `I_CONNECT_HOST` to the approved production hostname.
5. From `products/i-connect`, run:

```bash
docker compose -f deploy/docker-compose.owned.yml up -d --build
```

6. Verify container health and the public `/api/health` endpoint.
7. Only enable live PSTN, billing, or production customer onboarding after the I-CONNECT activation gates are green.

## Backup principle

Application source is stored in GitHub. Database backups are handled by the database provider or approved IZAKHONO database backup process. Caddy's `/data` and `/config` volumes should be included in the server backup policy.

## Recovery

A replacement server must be able to restore the repository, protected environment values, database access, and Caddy persistent volumes, then recreate the stack with the same Compose command.

## Security boundary

Never commit `deploy/.env`, carrier credentials, payment secrets, database service-role keys, or other production secrets. The repository contains configuration templates only.
