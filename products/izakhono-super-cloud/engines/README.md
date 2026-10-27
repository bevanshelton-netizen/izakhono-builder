# IZAKHONO SUPER CLOUD ENGINES

Engine runtime endpoints:

| Engine | Port | Role |
|---|---:|---|
| Deployment | 8191 | deployment state machine, evidence gate, rollback |
| Scheduler | 8192 | owned-first workload placement |
| Node Agent | 8193 | node heartbeat and workload acceptance |
| Domain | 8194 | DNS/TLS/ingress intent |
| Policy | 8195 | tenant, quota, evidence and fallback policy |

These are the first executable engines. Storage, image/build, observability and media engines follow the same contract and can be attached without changing the control-plane API.

All engines are intentionally adapter-based: an engine can plan work without pretending that an unavailable physical resource or external credential exists.
