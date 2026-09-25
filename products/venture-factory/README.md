# IZAKHONO Venture Factory

Independently deployable engine for the IZAKHONO AI Business Factory.

## Purpose

Turn a business idea into a structured product, revenue, build, validation and go-to-market plan. The engine uses IZAKHONO SUPER AI when configured and falls back safely to deterministic planning when the AI route is unavailable.

## Architecture

- own Node runtime and health endpoint
- own persistent plan store
- own static interface
- SUPER AI is a replaceable internal capability dependency, not a browser-side vendor SDK
- no behavioural tracking or advertising IDs
- no autonomous advertising spend, payment or external account mutation
- owned-first deployment through IZAKHONO CONTROL -> NODE
- reversible external hosting may be added separately

## Endpoints

- `GET /healthz`
- `POST /api/plan`
- `GET /api/plans`

Planning is owner-key protected by default. Set `VENTURE_FACTORY_PUBLIC_PLANNING=true` only after abuse controls and commercial access policy are ready.

## Promotion rule

A plan is not a live business. Promotion into IZAKHONO Builder and public deployment remain separate gates with their own validation receipts.

## Live rule

Do not call this service public-live until the owned route returns HTTPS 200 and the verified Venture Factory experience. An external resilience route does not replace the owned engine.
