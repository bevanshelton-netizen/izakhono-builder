# IZAKHONO SUPER SEO — Live Search Provider

V3 separates SEO logic from external search data. The engine never fabricates search volume, CPC, rankings, traffic or difficulty.

## Environment

Set these variables in the runtime hosting SUPER SEO:

- `SEARCH_PROVIDER_URL` — HTTPS endpoint accepting POST JSON.
- `SEARCH_PROVIDER_TOKEN` — bearer token for the provider.
- `SEARCH_PROVIDER_NAME` — optional display name.

Request body:

```json
{
  "query": "uniform supplier south africa",
  "locale": "en-ZA",
  "country": "ZA",
  "language": "en",
  "max_results": 10
}
```

Expected response:

```json
{
  "results": [
    {"position":1,"title":"...","url":"https://example.com/page","domain":"example.com","snippet":"..."}
  ],
  "metrics": {
    "search_volume": 1000,
    "cpc": 2.1,
    "competition": 0.42,
    "difficulty": 55
  }
}
```

`metrics` is optional. Each metric is only returned when the provider supplies a finite numeric value.

## API

- `GET /api/search/status` — provider configuration state.
- `POST /api/search` — expands seed keywords and returns observed SERP opportunities and competitor gaps.

If the provider is not configured, the API returns `provider_status: "not_configured"` and no live SERP results. Baseline keyword generation remains available through `/api/analyze`.

## Safety

The provider endpoint must use HTTPS. Search data is treated as observation, not a guarantee of rankings or traffic. The product does not automate backlink exchanges, paid ranking links, or mass low-value pages.
