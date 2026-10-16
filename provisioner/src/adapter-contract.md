# Provider Adapter Contract

Each connectivity provider is isolated behind a normalized adapter.

```text
checkCoverage(address, serviceType)
quote(product, coverage)
createOrder(order)
getOrderStatus(reference)
cancelOrder(reference)
```

Normalized result categories:

- `available`
- `unavailable`
- `manual_required`
- `pending`
- `confirmed`
- `failed`

Provider-specific payloads must never become part of the core state machine. The adapter translates them into normalized results.

A provider without API credentials remains explicitly `manual` until a verified integration is available.
