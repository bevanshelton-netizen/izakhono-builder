# IZAKHONO ONE — Completion Gates

IZAKHONO ONE is complete only when every service passes the same promotion ladder.

## Universal ladder

1. SOURCE — contract, adapter boundary and tests exist.
2. FOUNDATION — policy, audit and runtime state are attached.
3. STAGING — real provider/internal adapter is configured in a controlled environment.
4. VERIFIED — health checks, smoke tests and security checks pass.
5. OWNED LIVE — service is reachable through owned infrastructure and independently verified.

## Seven pillars

| Pillar | Foundation | Runtime | Adapter | Live gate |
|---|---|---|---|---|
| SEARCH | yes | stateful | required | verified retrieval/index path |
| CONNECTA | yes | stateful | required | verified identity/social path |
| ONE AI | yes | stateful | required | verified model/provider path |
| ONE CLOUD | yes | stateful | required | verified storage/workspace path |
| ONE COMMERCE | yes | stateful | required | verified catalog/order/payment path |
| IZAKHONO NAV | yes | stateful | required | verified routing/safety path |
| FORTRESS | yes | stateful | required | verified identity/threat/audit path |

## Security rule

A registered service is not automatically executable. Dispatch requires:

`known capability -> policy approval -> verified + healthy runtime -> service adapter`

Payment actions require verification. Destructive actions require authentication and policy approval. Unknown capabilities fail closed. Runtime remains `foundation/unknown` until independently verified.

## Infrastructure rule

Owned infrastructure is preferred. External infrastructure remains a reversible fallback. No deployment, public-live claim or production promotion is inferred from source commits alone.
