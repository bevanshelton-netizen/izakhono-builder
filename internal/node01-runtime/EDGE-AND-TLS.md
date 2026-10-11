# NODE01 Edge and TLS Contract

NODE01 workloads are private by default.

## Rules

- Public traffic terminates at an explicit edge gateway.
- TLS certificates are managed at the edge, never inside application containers.
- Internal services communicate over the private `izakhono` network.
- Only explicitly published ports may be reachable from outside NODE01.
- Registry port `5000` remains localhost/private.
- Health checks must pass before a route is promoted.
- Failed health checks remove a service from promotion rather than masking the failure.

## Initial routes

- `/commands` -> NODE01 control plane
- `/seo` -> SUPER SEO workload

These are route contracts, not claims that public DNS/TLS is currently live.
