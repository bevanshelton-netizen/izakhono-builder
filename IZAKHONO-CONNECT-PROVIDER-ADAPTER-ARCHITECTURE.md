# IZAKHONO CONNECT™ — Provider Adapter Architecture

## Objective
Create one replaceable integration contract for every connectivity supplier. CONNECT CONTROL must never hard-code customer workflows to a single upstream provider.

## Common adapter contract

```text
checkCoverage(address, serviceType)
quote(product, coverage)
createOrder(order)
getOrderStatus(reference)
cancelOrder(reference)
```

## Adapter lifecycle

PLANNED → READY → ACTIVE → DISABLED

`manual` mode is the safe default until a provider's API credentials, commercial agreement, API contract and test transaction have been verified.

## Capability model

Each provider can independently expose:

- coverage
- quote
- create_order
- order_status
- cancel_order

This allows hybrid operation where, for example, coverage is API-driven but order placement remains manual.

## Current provider registry

- OpenWeb
- Afrinet
- Openserve
- MTN
- Telkom
- Vumatel
- MetroFibre

Provider status and adapter capability must reflect verified readiness only. A provider being listed does **not** mean an API integration is live.

## Safety rules

1. Never expose supplier credentials to the browser.
2. Never mark a service provisioned without an upstream confirmation.
3. If an API fails, route the order to a manual exception workflow.
4. Make every provisioning step idempotent and retryable.
5. Record provider references and raw response metadata needed for audit, without storing secrets.
6. Keep the customer-facing product independent from the upstream provider name where commercially appropriate.

## Database foundation

Supabase now contains `public.iz_connect_provider_adapters`, keyed to the existing provider registry. Adapter capabilities can be registered as `manual`, `api`, or `hybrid`, with lifecycle status tracked as `planned`, `ready`, `active`, or `disabled`.

The database function `iz_connect_register_provider_adapter(...)` provides an authenticated control-plane registration path.

## Next implementation boundary

The next production-safe step is to implement the orchestration service around this contract, then add individual supplier adapters only after verified supplier credentials/API documentation are available. No simulated supplier response may be presented as real coverage, ordering or activation.
