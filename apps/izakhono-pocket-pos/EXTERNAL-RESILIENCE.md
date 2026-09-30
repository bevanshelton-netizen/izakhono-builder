# PocketPOS external resilience route

Status date: 2026-09-30

The independent PocketPOS Worker/D1 engine remains the primary target. The controlled Cloudflare deployment workflow currently stops at its credential gate because the repository has no Cloudflare API token/account ID available.

To avoid blocking application progress, PocketPOS has an explicitly non-authoritative external resilience path on the existing IZAKHONO Supabase project. It reuses the existing `izakhono-gateway` function rather than purchasing a new function slot.

## Resilience URL

`https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-gateway?app=pocketpos`

Health route:

`https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-gateway?app=pocketpos&api=health`

The health contract returns `authoritative:false`. This route must not be represented as the owned primary deployment.

## Data and security

The fallback database uses isolated `pp_*` tables with RLS enabled and no anon/authenticated table grants. Server access is mediated through the existing Edge Function using the server secret already managed by Supabase.

Owner activation is single-use and time-limited. Only the activation-token hash is stored. The raw activation token is never committed to the repository.

Sales are created server-side using stored product prices and branch stock. Cash/EFT settlement uses a transactional database function and audit entries. Browser state does not directly mark a payment as verified.

## Payments

Cash sales can be settled on the fallback path. EFT requires supervisor verification. iK Pay remains deliberately unavailable until real iKhokha production credentials are installed server-side and payment reconciliation is acceptance-tested.

## Go-live language

Current label: **external resilience pilot**.

Do not call PocketPOS fully live until the owned independent engine is deployed and passes HTTPS, login, inventory, cash/EFT, payment-provider and reconciliation acceptance tests.
