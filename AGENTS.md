# IZAKHONO Repository Operating Instructions

## CHECK IZAKHONO INFRASTRUCTURE FIRST

Before proposing, building, fixing, publishing, migrating or deploying anything in this repository, first inspect and use the IZAKHONO infrastructure path and current evidence.

Mandatory order:

1. Read `IZAKHONO-PLATFORM-INFRASTRUCTURE-DIRECTIVE.md`.
2. Check the owned route first: ISN-01 / NODE01 → CODE / Forge → data/auth/storage/queue/analytics → Runtime → FORTRESS → EDGE/TLS → IZAKHONO DNS.
3. Determine the currently verified public route and the external fallback route before changing hosting.
4. Preserve any verified Vercel, Cloudflare, GitHub Pages, Tunnel, Funnel, VPS, Supabase or other approved external route until the owned route passes every public cutover gate.
5. Do not assume IZAKHONO infrastructure is unavailable merely because an external deployment exists or recently failed.
6. Do not ask the owner to repeat “check our infrastructure.” Repository work must perform that check as a standing requirement.
7. Never call a platform “live,” “launched,” or “deployed” without evidence matching one of the approved status labels.
8. Do not silently change payments, pricing, customer records, settlement instructions, legal pages, authentication or data storage during a hosting change.
9. Prefer iKhokha for South African payment flows where that product's payment links, reconciliation and legal pages are actually ready.
10. If the owned route is unhealthy, keep or restore the last verified external route so customer access and revenue can continue.

This instruction is portfolio policy issued by IZAKHONO AFRICA (PTY) LTD on 22 September 2026. It applies to this repository and every platform/package within it unless a signed product-specific exception supersedes it.
