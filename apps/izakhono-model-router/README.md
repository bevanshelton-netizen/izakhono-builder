# IZAKHONO AI Router

A provider-neutral control plane inspired by the model-routing, prompt-compression and quota ideas shown in the supplied reference screenshots.

## MVP
- Capability-based model routing
- Session-preserving failover concept
- Prompt compression modes
- Free-tier / quota dashboard
- 25-provider adapter registry
- Owned-first / FORTRESS control principles

## Production wiring
Provider credentials must be configured server-side. The browser UI deliberately contains no API keys.

Next integration wave:
1. Server-side `/api/chat` gateway.
2. Provider adapters with health/latency/cost/quota telemetry.
3. IZAKHONO Brain local adapter (Ollama/vLLM/owned endpoint).
4. Persistent sessions and compressed context store.
5. Budget enforcement and automatic failover.
