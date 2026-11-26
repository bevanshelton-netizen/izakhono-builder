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

## Security configuration\n\n- Set `NAV_ALLOWED_ORIGINS` to a comma-separated list of exact trusted browser origins. An empty or unset value denies browser cross-origin access; the engine does not reflect arbitrary origins.\n- The in-memory rate limiter expires buckets by request window and caps its client-key store at 10,000 entries.\n- If the engine is deployed behind a proxy, enable `NAV_TRUST_PROXY` only when that proxy overwrites `X-Forwarded-For` with a trusted client address.\n\n## Start

```bash
cp .env.example .env
docker compose up -d --build
curl http://127.0.0.1:8788/health
```

It can run on any approved Runtime Fabric target. NODE01 is not required.
