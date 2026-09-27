# IZAKHONO ONE infrastructure policy

IZAKHONO ONE follows the portfolio standing rule: owned-first, externally reversible.

- Primary production route: **NODE 01 → IZAKHONO CODE → RUNTIME → EDGE/TLS → DNS**.
- The product carries its own independently deployable search, service-discovery, routing and health engine.
- IZAKHONO BUILDER is integrated through an **owned service bridge**, not by sharing or replacing either product engine.
- The optional `IZAKHONO_BUILDER_INTERNAL_URL` points IZAKHONO ONE to the independently running Builder on owned infrastructure. Only Builder's public health contract is proxied; no owner/admin secret is copied into ONE.
- Builder public routing remains gated until that route independently returns HTTPS 200 and the verified Builder experience.
- External hosting is a resilience route only and never replaces or controls the owned engine.
- External and owned traffic may be switched without rebuilding the application.
- No route is described as live until it returns HTTPS 200 and the verified IZAKHONO ONE experience.
- No telemetry, behavioural tracking, profiling or advertising identifiers are permitted.
- Downstream platforms remain legally and operationally separate. IZAKHONO ONE is an access layer, not a merger of records or entities.
