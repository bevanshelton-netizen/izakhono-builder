# IZAKHONO Native Model Runtime

Owned-first local inference service for IZAKHONO Builder. It removes hosted builder-credit dependencies and provides an Ollama-compatible model endpoint.

## Runtime
- Endpoint: http://127.0.0.1:11434/api/chat
- Model: qwen2.5-coder:3b (CPU-first baseline)
- Persistent model weights: Docker volume izakhono_model_data
- Public exposure: none; port binds to loopback only
- No AI-credit wallet, per-prompt meter or pay-per-action gate

## Start
Run from this directory: `docker compose -f compose.yml up -d`. The bootstrap service downloads model weights once. Initial download requires internet access and sufficient disk, RAM and CPU. Inference then runs locally.

Set these variables for the Builder process on the same Software NODE:
`IZAKHONO_LOCAL_MODEL_URL=http://127.0.0.1:11434/api/chat`
`IZAKHONO_LOCAL_MODEL=qwen2.5-coder:3b`

If the Builder and model runtime are on separate Software NODEs, connect them over an authenticated private overlay and explicitly allowlist the private hostname with IZAKHONO_MODEL_TRUSTED_HOSTS. Never expose the Ollama endpoint directly to public ingress.

## Acceptance
Check `curl http://127.0.0.1:11434/api/tags`. A generated build must report `generationMode=local-model` before model-backed generation is considered active. `deterministic-fallback` means the website artifact was produced without verified model inference.

This eliminates proprietary AI credits, not real compute costs. CPU, memory, storage, download bandwidth, backup, security and availability remain operational requirements. The 3B model is a practical baseline, not a claim of frontier-model parity.

## Intelligence Engine adapter

The shared model-routing core lives in `src/intelligence.ts`. It supports the
native Ollama `/api/chat` protocol used by this service and an OpenAI-compatible
`/chat/completions` adapter for approved endpoints. The router filters models
by declared task capabilities, health, context limit and explicit trust policy.
External fallback is possible only when `approved_external` is explicitly
allowed by the calling policy. The model endpoint's `baseUrl` is the API host
(for this local service: `http://127.0.0.1:11434`), not the full `/api/chat`
path.

Run the shared router checks from the repository root:
`npm run intelligence:test` and `npm run intelligence:typecheck`.

A passing mock-adapter test does not prove the Ollama container or owner node is
running. Use the provisioning/verification commands above for runtime acceptance.
