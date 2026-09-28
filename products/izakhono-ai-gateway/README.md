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

The gateway itself does not persist ordinary prompts, add behavioural tracking, or expose model credentials to browsers. When a caller explicitly selects durable media execution, the separate Media Runtime Fabric persists only the encrypted job payload required for resumability.

## Capabilities

| Capability | Default route | Default model label |
| --- | --- | --- |
| Chat | Ollama-compatible owner runtime | `qwen3:4b` |
| Reasoning | Ollama-compatible owner runtime | configurable |
| Code | Ollama-compatible owner runtime | configurable |
| Image | owner JSON generation adapter | `flux.1-schnell` |
| Video | owner IZAKHONO Video Runtime | `wan2.1` |
| Speech | owner IZAKHONO Speech Runtime | `kokoro` |
| Transcription | owner JSON generation adapter | `whisper` |

Image and transcription remain adapter contracts until their local runtimes are configured. Video and speech now have native IZAKHONO owner-runtime contracts. The health and capabilities endpoints still report `needs_backend` until the corresponding private runtime URL and internal credential are attached; configuration alone never creates an external route.

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

The request must also use `access_mode: "workflow"` and a product slug present in `IZAKHONO_AI_WORKFLOW_PRODUCTS`. The default portfolio allowlist covers the core internal engines plus IZAKHONO Shorts, IZAKHONO Create, KORA, Allegro, EDU-BUILD, IZAKHONO Ads, the recording-studio platform, WorkNow, FAISReady, DOXA-SURE and AUTO AI. Deployments can narrow that list through the environment.

Workflow mode does not create a customer subscription record and does not bypass the model/runtime owner-route restrictions. It exists for trusted internal automation only.

### IZAKHONO FLOW advisory use

FLOW uses the existing trusted workflow contract rather than a bespoke AI endpoint. Its adapter calls `POST /api/v1/generate` with:

- `product: "izakhono-flow"`
- `access_mode: "workflow"`
- `route: "owned"`
- `data_classification: "internal"`
- both internal gateway and workflow credentials.

FLOW sends only scoped operational context required for the advisory request. The model response is advisory: FLOW does not grant it authority to move money, confirm payment, make regulated decisions or send customer communications.

## Portfolio-wide owned speech and video

SUPER AI v0.3 routes the shared `speech` and `video` capabilities into the owner-hosted runtimes built for IZAKHONO Shorts. This makes the same engines reusable by KORA, EDU-BUILD, CREATE, advertising, training, recording-studio and other authorized portfolio products without those products depending on Shorts itself.

The owner Windows launcher automatically attaches the local speech runtime on port `9731` and video runtime on port `9741` only when each runtime independently returns a healthy local status and its machine-local credential is available. It does not copy those credentials into the repository or expose them to browsers.

Natural speech request:

```json
{
  "entity_id": "izakhono-africa",
  "product": "kora",
  "access_mode": "workflow",
  "capability": "speech",
  "route": "owned",
  "input": "Welcome to KORA.",
  "options": {
    "language": "English",
    "voice": "af_heart",
    "speed": 1.0
  }
}
```

Image-to-video request:

```json
{
  "entity_id": "izakhono-africa",
  "product": "izakhono-create",
  "access_mode": "workflow",
  "capability": "video",
  "route": "owned",
  "prompt": "Animate this original character walking through a bright African future city.",
  "source_image": "data:image/png;base64,...",
  "options": {
    "duration_seconds": 7,
    "aspect_ratio": "9:16"
  }
}
```

The gateway adds the required owned/privacy/originality policy fields and runtime authentication server-side. External routing is not supported for speech or video through this contract.

## Durable Media Runtime Fabric

Speech and video can now choose between immediate local execution and the shared durable Media Runtime Fabric.

Use `"execution":"durable"` for generation that may outlive a single HTTP request, needs retry/lease recovery, or should be scheduled across multiple approved workers:

```json
{
  "entity_id": "izakhono-africa",
  "product": "izakhono-create",
  "access_mode": "workflow",
  "capability": "video",
  "route": "owned",
  "execution": "durable",
  "prompt": "Animate this original vertical scene.",
  "source_image": "data:image/png;base64,...",
  "job_options": {
    "priority": 70,
    "max_attempts": 4,
    "min_gpu_mb": 12000
  }
}
```

SUPER AI converts that request into the native IZAKHONO media contract and submits it to the private fabric. The response contains a job ID, a one-time-visible `job_token`, and a `poll_path`. The token must be retained by the calling backend; it is not stored by SUPER AI.

Poll the returned path with the normal `x-izakhono-ai-key` plus `x-izakhono-job-token`. Completed artifacts are surfaced with gateway paths so products do not need the Media Fabric credential or private broker topology.

Durable execution is deliberately different from normal prompt handling: the fabric must persist the job to survive worker failure. It stores the media payload AES-GCM encrypted at rest, does not log prompt/body content, and encrypts completed job metadata. Generated artifacts are stored separately with SHA-256 integrity evidence.

`GET /healthz` reports the Media Fabric as `configured`, `ok`, `production_ready`, its healthy-worker count and whether replicated storage is proven. A healthy broker is not the same as production-HA; production readiness remains false until replicated state storage and at least one healthy worker are verified.

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
- `IZAKHONO_AI_ROUTING_EWMA_ALPHA` — weight given to the newest successful latency sample
- `IZAKHONO_AI_ROUTING_UNKNOWN_LATENCY_MS` — neutral estimate before a runtime has benchmark samples
- `IZAKHONO_AI_ROUTING_INFLIGHT_PENALTY_MS` — score penalty for each active request on a runtime
- `IZAKHONO_AI_ROUTING_WARM_BONUS_MS` — score advantage for a recently warm requested model
- `IZAKHONO_AI_WARM_MODELS` — comma-separated approved owner models to warm
- `IZAKHONO_AI_WARM_KEEP_ALIVE` — Ollama-compatible keep-alive value used by the warm command
- `IZAKHONO_AI_WARM_TTL_SECONDS` — how long a successful warm/use is treated as warm for routing
- `IZAKHONO_AI_WARM_ON_START=false` — opt-in owner-machine warm-up after the gateway health gate
- `IZAKHONO_AI_CHAT_MODEL`
- `IZAKHONO_AI_CHAT_MODELS`
- `IZAKHONO_AI_REASONING_MODEL`
- `IZAKHONO_AI_REASONING_MODELS`
- `IZAKHONO_AI_CODE_MODEL`
- `IZAKHONO_AI_CODE_MODELS`

Media routing:

- `IZAKHONO_IMAGE_URL`
- `IZAKHONO_IMAGE_MODEL`
- `IZAKHONO_VIDEO_URL` — private owner runtime base URL; launcher auto-discovers healthy local port 9741
- `IZAKHONO_VIDEO_INTERNAL_KEY` — server-side video runtime credential
- `IZAKHONO_VIDEO_MODEL`
- `IZAKHONO_SPEECH_URL` — private owner runtime base URL; launcher auto-discovers healthy local port 9731
- `IZAKHONO_SPEECH_INTERNAL_KEY` — server-side speech runtime credential
- `IZAKHONO_SPEECH_MODEL`
- `IZAKHONO_TRANSCRIPTION_URL`
- `IZAKHONO_TRANSCRIPTION_MODEL`
- `IZAKHONO_MEDIA_FABRIC_URL` — private owner broker route used for durable speech/video execution
- `IZAKHONO_MEDIA_FABRIC_INTERNAL_KEY` — server-side broker credential; never exposed to products or browsers

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

## Warm model pool and benchmark-aware routing

Successful owner-runtime text calls now feed an in-memory exponentially weighted moving average (EWMA) latency benchmark per runtime and per model. For each new owned chat/reasoning/code request, SUPER AI combines that measured latency with current in-flight work and whether the requested model is recently warm. The lowest score is tried first, while cooldown/failover remains in force.

This is adaptive routing, not a synthetic benchmark claim: a runtime starts with a neutral configured latency estimate and earns routing preference only from successful observed calls. Benchmark state resets when the gateway restarts.

Owner models can be explicitly warmed through authenticated `POST /api/v1/warm` or the Windows owner command `WARM-OWNER-MODELS.cmd`. Warming calls the owner runtime's Ollama-compatible `/api/generate` interface with an empty prompt and a bounded `keep_alive`; it never sends product/customer content and never warms an external provider.

Warming is **not enabled automatically by default** because keeping several models resident can consume significant owner RAM/VRAM. Set `IZAKHONO_AI_WARM_ON_START=true` only on a machine sized for the configured warm models.

The public health endpoint exposes only the routing strategy plus aggregate warm-pool counts. The authenticated `GET /api/v1/runtimes` view includes sanitized runtime labels, observed EWMA latency, sample counts, warm model names and per-model benchmark summaries without returning backend addresses.

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

The owner runtime layer now includes multiple text runtimes plus native private speech and generative-video contracts, strict owner-host validation, bounded admission control, adaptive text routing, explicit warm-model management and sanitized runtime status.

The next runtime phases are durable cross-machine media job queues, resumable long-running generation, artefact storage, transcription workers and hardware-aware scheduling. They remain behind the same SUPER AI contract so individual IZAKHONO products do not need rewrites as runtime capacity changes.

See `MODEL-CATALOG.md` for the free/open-weight intake baseline.
