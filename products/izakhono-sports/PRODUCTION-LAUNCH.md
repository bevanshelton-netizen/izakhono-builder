# IZAKHONO SPORTS — Production Launch

## Target architecture

- Web: `apps/web` (Next.js)
- API: `apps/api` (Fastify)
- Database: PostgreSQL 17
- Runtime: Docker Compose on IZAKHONO-owned infrastructure
- TLS: reverse proxy / edge terminating HTTPS
- Database: private network only; never publish PostgreSQL publicly
- Migrations: `/migrations` mounted read-only and applied by API startup
- Payments: provider-neutral billing boundary; connect approved gateway credentials only in production

## Required production environment

```env
POSTGRES_PASSWORD=<strong-random-secret>
```

The API derives `DATABASE_URL` from the compose stack. Do not commit production secrets.

## Launch

```bash
cd products/izakhono-sports
export POSTGRES_PASSWORD='REPLACE_ME'
docker compose up -d --build
docker compose ps
curl -fsS http://127.0.0.1:8080/health
```

The web service listens on port 3000 and the API on port 8080. Put both behind the production reverse proxy; expose only the required HTTPS entry points publicly.

## Acceptance gate

1. API `/health` returns HTTP 200 and `status=ok`.
2. Database reports healthy.
3. Web application returns HTTP 200.
4. Auth/session creation and organisation scoping pass end-to-end tests.
5. Public Sports ID is accessible only for profiles explicitly marked public.
6. Athlete discovery respects visibility and sponsorship-ready controls.
7. Sponsor offer → decision → contract → signing lifecycle passes end-to-end.
8. Competition event/live/result/approval flow passes end-to-end.
9. Billing webhook verification is enabled before accepting real payments.
10. PostgreSQL backup and restore are tested before launch.
11. TLS is valid and HTTP redirects to HTTPS.
12. Logs and uptime monitoring are enabled.

## Vercel note

The existing Vercel project is **not the production foundation**. Its project root has been corrected to `products/izakhono-sports/apps/web`, but deployment is currently blocked by the team's Vercel free daily deployment quota. The owned-first Docker stack remains the authoritative production path.

## Go-live rule

Do not advertise IZAKHONO SPORTS as production-live until the acceptance gate above has been executed against the actual production host and database.
