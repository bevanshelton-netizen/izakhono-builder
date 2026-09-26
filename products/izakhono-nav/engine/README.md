# IZAKHONO NAV ENGINE v1.0

Independent, node-agnostic navigation API for IZAKHONO NAV.

## Engine responsibilities

- runtime identity and health;
- routing API boundary at `/v1/route`;
- search/geocoding boundary at `/v1/search`;
- tile boundary at `/v1/tiles/{z}/{x}/{y}`;
- fail-closed behavior when owned navigation backends are unavailable;
- optional resilience adapters only when explicitly enabled;
- rate limiting, CORS and security headers;
- no analytics, ad IDs, behavioral tracking or raw search-query logs.

The engine never fabricates a straight-line route and calls it road navigation. If no approved router/search/tile backend exists, that capability returns 503.

## Start

```bash
cp .env.example .env
docker compose up -d --build
curl http://127.0.0.1:8788/health
```

It can run on any approved Runtime Fabric target. NODE01 is not required.
