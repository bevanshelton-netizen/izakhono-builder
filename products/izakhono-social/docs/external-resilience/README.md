# Supabase compatibility bridge — external resilience only

On 29 September 2026, the existing IZAKHONO WebStart CONNECTA compatibility layer was extended additively while the sovereign CONNECTA product was being upgraded.

This directory preserves the exact external-resilience evidence:
- `connecta-external-v8.ts.txt` — exact TypeScript source captured from the deployed `connecta-external` Edge Function version 8, stored as evidence text so the Next.js TypeScript compiler does not treat Deno runtime code as web-app source.
- `supabase-20260929-connecta-social-v2.sql` — additive schema extension applied to the external CONNECTA tables.
- `SUPABASE-COMPATIBILITY-API.md` — compatibility actions exposed by that adapter.

This bridge is **not** the production authority for CONNECTA. The authoritative target remains the owned CONNECTA Web + CONNECTA ENGINE + PostgreSQL stack on IZAKHONO infrastructure. Do not claim the external route public/live without independent URL/HTTPS verification.
