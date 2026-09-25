# CONNECTA external static route

This directory contains the public static CONNECTA resilience frontend.

- Backend: `https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/connecta-external`
- Primary authority: IZAKHONO-owned NODE01 CONNECTA engine
- External data layer: isolated `connecta_*` tables with RLS and no anon/authenticated table access
- Browser session: temporary `sessionStorage` bearer token on the external bridge only
- Tracking: no application analytics, advertising IDs, behavioural profiling or third-party scripts
- Distribution: intended to be served from an immutable Git commit through a free external CDN

The external route must never replace the owned NODE01 route.


## Architecture status

The Supabase Edge backend referenced by this static bridge is transitional only. The canonical external deployment must run CONNECTA ENGINE 0.2.0 (or later) from `engine/Dockerfile`, using PostgreSQL plus a durable local or S3-compatible storage adapter. Do not treat the Edge reimplementation as the permanent CONNECTA authority.
