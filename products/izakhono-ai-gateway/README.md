# IZAKHONO SUPER AI

IZAKHONO SUPER AI is the portfolio-wide, provider-neutral intelligence layer for IZAKHONO products.

It grows the original **IZAKHONO AI GATEWAY** into one controlled interface for chat, reasoning, coding, image generation, video generation, speech and transcription while preserving the standing rule: **owned-first, external adapters replaceable, no product hard-codes an outside AI vendor**.

## Core path

```
IZAKHONO PRODUCT
  -> IZAKHONO ID / ACCESS
  -> IZAKHONO SUPER AI
  -> capability router
  -> owner-controlled model/runtime
  -> optional approved external resilience adapter
```

The gateway does not persist prompts, add behavioural tracking, or expose model credentials to browsers.

## Capabilities

| Capability | Default route | Default model label |
| --- | --- | --- |
| Chat | Ollama-compatible owner runtime | `qwen3:4b` |
| Reasoning | Ollama-compatible owner runtime | configurable |
| Code | Ollama-compatible owner runtime | configurable |
| Image | owner JSON generation adapter | `flux.1-schnell` |
| Video | owner JSON generation adapter | `wan2.1` |
| Speech | owner JSON generation adapter | `kokoro` |
| Transcription | owner JSON generation adapter | `whisper` |

Image/video/speech/transcription are adapter contracts until their local runtimes are configured. The health and capabilities endpoints report that truthfully as `needs_backend`; they are not called live merely because the route exists.

## APIs

### Backward-compatible chat

`POST /api/v1/chat`

Headers:

- `x-izakhono-ai-key` — internal product credential

Body:

```json
{
  "entity_id": "faisready-entity",
  "subject": "customer@example.com",
  "product": "faisready",
  "model": "qwen3:4b",
  "messages": [
    {"role":"user","content":"Explain the FAIS fit-and-proper requirements."}
  ]
}
```

### Multi-capability generation

`POST /api/v1/generate`

```json
{
  "entity_id": "izakhono-africa",
  "subject": "customer@example.com",
  "product": "izakhono-ai",
  "capability": "image",
  "prompt": "Premium African technology company hero image",
  "options": {"aspect_ratio":"16:9"}
}
```

### Capability inspection

`GET /api/v1/capabilities` with the internal gateway key.

### Health

`GET /healthz`


## Trusted internal workflow mode

Owner-controlled IZAKHONO services such as Venture Factory, IZAKHONO DOCFLOW and IZAKHONO FLOW can use SUPER AI without pretending to be a paid end-user subscription.

Workflow mode requires **both**:

- `x-izakhono-ai-key` — the normal internal gateway key; and
- `x-izakhono-ai-workflow-key` — a separate workflow credential.

The request must also use `access_mode: "workflow"` and a product slug present in `IZAKHONO_AI_WORKFLOW_PRODUCTS`. The default allowlist is `venture-factory,izakhono-builder,izakhono-docflow,izakhono-flow`.

Workflow mode does not create a customer subscription record and does not bypass the model/runtime owner-route restrictions. It exists for trusted internal automation only.

### IZAKHONO FLOW advisory use

FLOW uses the existing trusted workflow contract rather than a bespoke AI endpoint. Its adapter calls `POST /api/v1/generate` with:

- `product: "izakhono-flow"`
- `access_mode: "workflow"`
- `route: "owned"`
- `data_classification: "internal"`
- both internal gateway and workflow credentials.

FLOW sends only scoped operational context required for the advisory request. The model response is advisory: FLOW does not grant it authority to move money, confirm payment, make regulated decisions or send customer communications.

## Security and cost controls

- model allowlists are capability-specific
- model/runtime URLs are owner/private routes by default
- public external inference is disabled by default
- internal subscription identity is checked through IZAKHONO ACCESS
- no browser-side model secrets
- no raw prompt persistence in this service
- no behavioural analytics or advertising IDs
- no hidden message-credit counter for an active paid subscription
- fair-use and infrastructure capacity limits still apply
- open-weight software can remove licence/API fees, but compute, storage and bandwidth are not free

## Environment

Text routing:

- `IZAKHONO_OLLAMA_URL`
- `IZAKHONO_AI_OWNER_TEXT_URLS` — ordered comma-separated owner runtimes for chat/reasoning/code failover
- `IZAKHONO_AI_OWNER_POOL_COOLDOWN_SECONDS` — temporary cooldown after a failed runtime call
- `IZAKHONO_AI_OWNER_POOL_MAX` — hard cap on configured owner text runtimes
- `IZAKHONO_AI_MAX_INFLIGHT` — gateway-wide maximum simultaneous inference requests
- `IZAKHONO_AI_MAX_QUEUE` — maximum requests allowed to wait for capacity
- `IZAKHONO_AI_QUEUE_TIMEOUT_SECONDS` — maximum time a queued request may wait
- `IZAKHONO_AI_CHAT_MODEL`
- `IZAKHONO_AI_CHAT_MODELS`
- `IZAKHONO_AI_REASONING_MODEL`
- `IZAKHONO_AI_REASONING_MODELS`
- `IZAKHONO_AI_CODE_MODEL`
- `IZAKHONO_AI_CODE_MODELS`

Media routing:

- `IZAKHONO_IMAGE_URL`
- `IZAKHONO_IMAGE_MODEL`
- `IZAKHONO_VIDEO_URL`
- `IZAKHONO_VIDEO_MODEL`
- `IZAKHONO_SPEECH_URL`
- `IZAKHONO_SPEECH_MODEL`
- `IZAKHONO_TRANSCRIPTION_URL`
- `IZAKHONO_TRANSCRIPTION_MODEL`

Trust boundary:

- `IZAKHONO_AI_OWNER_ONLY=true` by default
- `IZAKHONO_AI_OWNER_HOSTS=127.0.0.1,localhost` plus any explicitly approved owner hostnames
- `IZAKHONO_AI_ALLOW_EXTERNAL=false` by default

## Health-aware owner text pool

Chat, reasoning and coding can now use more than one owner-controlled Ollama-compatible runtime without changing any IZAKHONO product.

Configure the ordered pool with `IZAKHONO_AI_OWNER_TEXT_URLS`. The gateway attempts owner runtimes in preference order, temporarily cools down a runtime after a failed call, and fails over to the next allowed owner runtime. If every configured runtime is cooling down, the gateway retries them in configured order instead of becoming permanently stuck.

Owner pool endpoints are subject to a stricter trust rule than external development adapters: they must resolve to loopback/private/link-local addresses or be explicitly listed in `IZAKHONO_AI_OWNER_HOSTS`. Enabling NVIDIA or another external adapter does not make arbitrary public hosts valid owner runtimes.

The public `/healthz` endpoint exposes only pool counts. The authenticated `GET /api/v1/runtimes` endpoint exposes runtime labels such as `owner-text-1`, cooldown state, failure count and last-success metadata without returning the configured backend URLs.

Use `OWNER-MODEL-POOL.env.example` as the configuration template. Each runtime must independently contain the models it may be asked to serve.

## Bounded queue and workload distribution

SUPER AI now applies gateway-wide admission control before inference work begins. `IZAKHONO_AI_MAX_INFLIGHT` caps simultaneous model work, while `IZAKHONO_AI_MAX_QUEUE` limits waiting requests and `IZAKHONO_AI_QUEUE_TIMEOUT_SECONDS` limits how long they may wait.

When the queue is full or a queued request times out, the gateway returns a retryable `503 capacity_unavailable` response instead of allowing unbounded request growth.

For owned text workloads, available runtimes are ordered by current in-flight load; configured pool order is used only as the tie-breaker. Failed runtimes still enter cooldown and healthy capacity is preferred.

The public health endpoint exposes aggregate active/queued counts. The authenticated `GET /api/v1/runtimes` view adds admission statistics and per-runtime in-flight counts without returning backend addresses.

This is bounded in-process back-pressure for one gateway instance. Durable cross-machine queues and resumable long-running jobs remain a separate Runtime Fabric layer.

## Optional external text route

The gateway now supports an **explicit, protected OpenAI-compatible outbound text adapter** for development, benchmarking and resilience testing.

It remains off unless all of these conditions are true:

- `IZAKHONO_AI_ALLOW_EXTERNAL=true`
- `IZAKHONO_AI_OWNER_ONLY=false`
- the external base URL host is present in `IZAKHONO_AI_EXTERNAL_HOSTS`
- a server-side API key and model are configured
- the request explicitly sets `"route": "external"`
- the request explicitly sets `"data_classification": "public"`

Anything classified as internal, confidential or restricted is rejected before a prompt can be sent to the external adapter. There is no automatic external failover for private IZAKHONO workloads.

Example development configuration for NVIDIA's OpenAI-compatible hosted endpoint:

```text
IZAKHONO_AI_ALLOW_EXTERNAL=true
IZAKHONO_AI_OWNER_ONLY=false
IZAKHONO_AI_EXTERNAL_TEXT_PROVIDER=nvidia-nim
IZAKHONO_AI_EXTERNAL_TEXT_URL=https://integrate.api.nvidia.com/v1
IZAKHONO_AI_EXTERNAL_TEXT_API_KEY=<server-side secret>
IZAKHONO_AI_EXTERNAL_TEXT_MODEL=nvidia/nemotron-3-ultra-550b-a55b
IZAKHONO_AI_EXTERNAL_TEXT_MODELS=nvidia/nemotron-3-ultra-550b-a55b
IZAKHONO_AI_EXTERNAL_HOSTS=integrate.api.nvidia.com
```

A request that intentionally uses that public-data route can include:

```json
{
  "entity_id": "izakhono-africa",
  "product": "izakhono-builder",
  "access_mode": "workflow",
  "capability": "code",
  "route": "external",
  "data_classification": "public",
  "messages": [{"role":"user","content":"Review this public example."}]
}
```

This adapter is a replaceable development/resilience route, not a change to the owned-first default.

### Activation pack

The repository now includes:

- `EXTERNAL-AI.env.example` — a secret-free configuration template.
- `VERIFY-EXTERNAL-AI.cmd` / `VERIFY-EXTERNAL-AI.ps1` — an end-to-end public-data verification that writes a local receipt and never stores the provider API key.
- the normal `START-IZAKHONO-SUPER-AI-NODE01.ps1` launcher now detects whether the running gateway matches the requested external-routing state and restarts it when necessary.

The verifier deliberately uses a harmless public marker prompt. A successful receipt proves only that the configured development adapter works through the gateway; it does not establish a public-live production deployment.

For the shortest owner-machine path, run `ACTIVATE-NVIDIA-NIM-DEV.cmd`. It prepares the non-secret NVIDIA route, requests a DPAPI-protected credential only if one is not already stored, starts/restarts SUPER AI in the requested external-routing mode, and runs the public-data verification. It still requires the existing IZAKHONO gateway/workflow credentials to be present in the approved owner environment.

### Windows secret handling

For the owner Windows runtime, `SET-EXTERNAL-AI-SECRET.cmd` accepts the provider credential through a secure prompt and stores only the DPAPI-encrypted form under the current Windows user's Local AppData. The credential is not committed or printed.

`CONFIGURE-NVIDIA-NIM-DEV.cmd` prepares the non-secret NVIDIA development-route settings separately. The normal SUPER AI launcher can decrypt the local DPAPI secret for the same Windows user when the external route is explicitly enabled.

This is a convenience boundary for an owner workstation, not a substitute for an enterprise secrets manager on a multi-user or server deployment.

## DeepSeek Harness evaluation

DeepSeek Harness is treated as a **replaceable developer-preview coding agent**, not as trusted production infrastructure. IZAKHONO CODE includes an isolated evaluation launcher and policy in `products/izakhono-code/DEEPSEEK-HARNESS-SANDBOX.md`.

The Harness sandbox must not be pointed at production repositories, secrets, FORTRESS intelligence, customer records or unpublished proprietary source. Its workspace and `DSH_HOME` are isolated under the current Windows user's `%LOCALAPPDATA%\Izakhono\HarnessSandbox` path.

## Subscriber rule

An active subscription is not converted into a second hidden message-credit system. Responses continue to report:

- `usage_credit_gate: false`
- `message_quota: null`
- `session_quota: null`
- `fair_use: true`

That means no artificial message-credit counter. It does not mean infinite compute, bandwidth, storage, GPU capacity or permission to abuse the service.

## Build direction

The owner text runtime layer now includes multiple owner runtimes, strict owner-host validation, failure cooldown, failover, bounded admission control, least-loaded workload distribution, sanitized runtime status and IZAKHONO CODE visibility.

The next runtime phases are model warm-pool management, benchmark-aware routing, durable cross-machine job queues, artefact storage and owner-hosted image/video/speech/transcription worker pools. They remain behind the same SUPER AI contract so individual IZAKHONO products do not need rewrites as runtime capacity changes.

See `MODEL-CATALOG.md` for the free/open-weight intake baseline.
