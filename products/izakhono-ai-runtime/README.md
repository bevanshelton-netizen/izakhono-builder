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

If the Builder and model runtime are on separate Software NODEs, connect them over an authenticated private overlay and use a private IP or reserved `.local` / `.internal` hostname. Public hostnames are rejected; no public-host allowlist exists. Never expose the Ollama endpoint directly to public ingress.

## Acceptance
Check `curl http://127.0.0.1:11434/api/tags`. A generated build must report `generationMode=local-model` before model-backed generation is considered active. `deterministic-fallback` means the website artifact was produced without verified model inference.

This eliminates proprietary AI credits, not real compute costs. CPU, memory, storage, download bandwidth, backup, security and availability remain operational requirements. The 3B model is a practical baseline, not a claim of frontier-model parity.

## Inference trust boundary

All inference uses the Ollama-compatible `/api/chat` protocol on a loopback or private IZAKHONO-owned network endpoint. The default remains `http://127.0.0.1:11434/api/chat`.

- Hosted model APIs and `approved_external` endpoints are disabled.
- A second owner-controlled Software NODE may be reached only over a private overlay using a private IP or reserved `.local` / `.internal` hostname.
- Public HTTPS model endpoints, API-key provider fallbacks and external provider rotation are rejected.
- If no eligible local runtime is reachable, the caller uses deterministic native generation or returns a clear capability-unavailable result.
- Model adapters do not own task state, repository state, authorization or release evidence.

Run the shared router checks from the repository root:
`npm run intelligence:test` and `npm run intelligence:typecheck`.

A passing mock-adapter test does not prove the Ollama container or owner node is running. Use the provisioning/verification commands above for runtime acceptance.
