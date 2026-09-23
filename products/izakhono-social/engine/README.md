# CONNECTA ENGINE

CONNECTA ENGINE is the self-hosted application core for CONNECTA.

It is designed so the social network can continue to operate without Meta, Google, Vercel, Supabase, OpenAI or another SaaS provider being required for core functionality.

## Owned capabilities

- local account registration and password authentication
- server-side password hashing with Node scrypt
- opaque revocable sessions stored in CONNECTA's database
- profiles, follows and connection requests
- user-controlled feed modes
- deterministic Balanced feed based only on explicit relationships + recency
- posts, comments and reactions
- baseline server-side text moderation
- report intake and moderation queue
- owner moderation decisions
- local filesystem media storage on the owned host
- audit trail restricted to security/moderation operations
- database-backed abuse-rate counters
- PostgreSQL schema and migration runner

## No-surveillance feed

CONNECTA ENGINE does not use behavioural engagement history for feed ranking.

Balanced mode uses only:
1. accepted connections,
2. accounts the user explicitly follows,
3. communities the user explicitly joined,
4. chronological recency.

There is no advertising ID, cross-site tracking identity, dwell-time score or hidden engagement profile in the engine.

## Core routes

- `GET /health`
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `GET /v1/me`
- `GET /v1/feed?mode=balanced`
- `POST /v1/posts`
- `POST /v1/posts/:id/comments`
- `POST /v1/posts/:id/reactions`
- `POST /v1/follows/:accountId`
- `POST /v1/connections/:accountId`
- `POST /v1/reports`
- `POST /v1/media`
- `PUT /v1/media/:id/content`
- `GET /v1/media/:id/content`
- `GET /v1/admin/moderation`
- `PATCH /v1/admin/moderation/:caseId`

## NODE01 deployment

From `products/izakhono-social`:

```bash
export CONNECTA_DB_PASSWORD='use-a-long-random-secret'
export CONNECTA_OWNER_KEY='use-a-different-long-random-secret'
export CONNECTA_PORT=3080
docker compose -f docker-compose.owned.yml up -d --build
```

The public reverse proxy/TLS layer should expose only the web service. PostgreSQL and the engine remain on the private Docker network.

## Independence boundary

CONNECTA owns its application logic and data model. PostgreSQL, Node.js and container tooling are replaceable infrastructure components, not remote SaaS dependencies. The engine API and SQL schema stay portable so a future IZAKHONO database/runtime can replace them without changing the product contract.
