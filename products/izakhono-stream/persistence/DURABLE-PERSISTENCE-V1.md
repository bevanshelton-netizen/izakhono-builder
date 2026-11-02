# IZAKHONO STREAM — Durable Entitlement Persistence V1

## Purpose

This layer closes the gap between a verified payment webhook and the authoritative entitlement used by playback authorization.

The database is the source of truth for entitlement state. Payment processors are event sources and must never be queried directly by the player to decide access.

## Durable invariants

1. `(tenant_id, provider, event_id)` is unique, so a webhook cannot create duplicate entitlement mutations.
2. Webhook reservation and entitlement mutation occur inside one database transaction.
3. `PAID` can create or activate an entitlement.
4. `REFUNDED`, `CANCELLED`, and `FAILED` cannot leave an entitlement active.
5. Every entitlement transition has an audit record.
6. Tenant identifiers are carried on every business record.
7. Playback reads the durable entitlement state again at session creation.
8. Browser roles have no direct access to webhook or entitlement tables.
9. Retry/dead-letter processing can safely replay an event because reservation is idempotent.
10. Provider-specific signature verification remains outside the persistence layer.

## Supabase posture

The reference migration uses PostgreSQL tables with RLS enabled and explicitly revokes `anon` and `authenticated` access because this is server-side control-plane state. Supabase recommends enabling RLS for exposed tables and matching grants to the application's actual access model. citehttps://supabase.com/docs/guides/database/postgres/row-level-security

The migration is intentionally **not applied to a remote Supabase project** in this milestone. No existing Supabase project was identified as an approved IZAKHONO STREAM production database. The repository therefore remains the source of truth until a dedicated STREAM database is selected.

## Production gate

The persistence layer is not production-approved until all of the following are demonstrated:

- migration applied to the designated STREAM database;
- transactional duplicate webhook test passes;
- concurrent duplicate delivery test passes;
- PAID → ACTIVE test passes;
- REFUNDED/CANCELLED/FAILED → REVOKED test passes;
- tenant isolation test passes;
- audit completeness test passes;
- backup/restore test passes;
- reconciliation test passes;
- real provider sandbox webhook verification passes.

Database migrations should remain version-controlled and deployed through the migration workflow rather than by undocumented remote edits. citehttps://supabase.com/docs/guides/deployment/database-migrations
