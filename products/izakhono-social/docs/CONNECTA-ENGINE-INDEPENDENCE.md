# CONNECTA ENGINE Independence Contract

CONNECTA ENGINE is a product-specific engine. It must remain independently deployable and must not depend on another IZAKHONO product engine.

## Core ownership

CONNECTA owns its own:

- authentication and sessions;
- social graph;
- profiles, posts, comments, reactions and communities;
- moderation and zero-tolerance safety enforcement;
- anti-cloning and identity protection;
- content provenance and altered-image detection;
- notifications;
- business verification;
- growth/onboarding logic;
- database schema and migrations;
- media-storage interface;
- health and readiness contract.

## Required infrastructure, not product dependencies

The engine requires only two infrastructure primitives:

1. **PostgreSQL**
2. **Durable media storage**

Both are replaceable infrastructure adapters.

### PostgreSQL

The engine uses the standard PostgreSQL wire protocol through `DATABASE_URL`.

It has no Supabase-specific, Render-specific, Railway-specific, Vercel-specific or cloud-vendor database code.

On startup, CONNECTA ENGINE:

1. waits for PostgreSQL;
2. takes a PostgreSQL advisory migration lock;
3. applies any unapplied CONNECTA migrations exactly once;
4. starts the HTTP engine only after migrations pass.

This lets multiple replicas start safely without provider-specific migration orchestration.

### Media storage

`CONNECTA_STORAGE_DRIVER=local` is the owned/default path and uses a durable mounted volume.

`CONNECTA_STORAGE_DRIVER=s3` is an optional adapter for any S3-compatible object store, including self-hosted MinIO or external S3-compatible providers.

S3 is therefore a storage protocol adapter, **not a CONNECTA application dependency**.

## Portable deployment

For a generic Docker host:

```bash
cp .env.portable.example .env
# Set CONNECTA_DB_PASSWORD and CONNECTA_OWNER_KEY.
docker compose -f docker-compose.portable.yml up -d --build
```

Then verify:

```bash
curl -fsS http://127.0.0.1:4100/health
```

A valid engine response must prove:

- `database: "ok"`
- `storage: "ok"`
- `providerIndependent: true`
- `productEngine: "CONNECTA"`
- `dependsOnAnotherProductEngine: false`
- `externalServicesReplaceableAdaptersOnly: true`

## External hosting rule

External hosts may provide compute, PostgreSQL, disks or S3-compatible object storage.

They must never own CONNECTA's application logic.

No deployment may replace CONNECTA ENGINE with:

- Supabase Edge application logic;
- Vercel-only application logic;
- Render-only application logic;
- Railway-only application logic;
- another IZAKHONO product engine;
- a proprietary social-network backend.

Provider-specific components are permitted only as reversible infrastructure adapters.

## Data portability

The canonical data model remains CONNECTA PostgreSQL migrations plus media object keys.

Changing hosting providers must not require changing:

- user IDs;
- post/community IDs;
- moderation records;
- verification records;
- media ownership records;
- engine API contracts.

## Privacy

The engine itself contains no behavioural analytics, advertising IDs or cross-site profiling.

Operational infrastructure logs may be used only for security, reliability and debugging.

## Standing launch rule

A route is not LIVE until that route independently proves HTTPS availability and the real CONNECTA engine-backed experience.

The external resilience route may launch before NODE01, but it must run CONNECTA ENGINE itself. A provider-specific substitute is not an acceptable final architecture.
