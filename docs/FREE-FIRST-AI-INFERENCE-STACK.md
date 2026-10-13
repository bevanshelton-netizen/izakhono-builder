# IZAKHONO Free-First AI Inference Stack

## What the Reel contributes

The Reel points to `awesome-free-llm-apis`, a machine-readable directory of free/trial LLM APIs and provider configuration examples. The live directory is refreshed regularly and currently covers hundreds of models across dozens of providers. It is useful as a **discovery source**, not as an authority that guarantees a permanent quota or commercial right.

## IZAKHONO implementation

The Builder now contains:

- `config/free-llm-router.v1.json` — provider-neutral registry and routing policy.
- `tools/izakhono_llm_router.py` — local routing selector with environment-variable secret detection.

The router is deliberately **free-first**, not free-only:

1. Prefer an available low/no-cost provider.
2. Fail over to the next provider for the same capability.
3. Keep credentials server-side/environment-only.
4. Never bake API keys into generated customer applications.
5. Verify current provider limits and commercial terms before production workloads.
6. Prefer local/self-hosted inference when it is practical and cheaper.

## Initial routing strategy

| Work | Preferred candidates |
|---|---|
| Fast text | Groq → Gemini → OpenRouter |
| Reasoning | OpenRouter → NVIDIA NIM → Gemini |
| Coding | Groq → Mistral → OpenRouter → GitHub Models |
| Vision | Gemini → NVIDIA NIM → OpenRouter |
| Audio | Gemini → OpenRouter → NVIDIA NIM |
| Video | OpenRouter → Gemini → NVIDIA NIM |
| PDF | Gemini → NVIDIA NIM → GitHub Models |

These are **routing preferences**, not claims that every provider currently offers every model or quota shown in a social-media post. Provider limits change.

## Why this matters to the One-Day App Factory

The App Factory should not be locked to one model. A build job can request a capability:

`BUILD UI` → `code`

`ANALYSE REQUIREMENTS` → `reasoning`

`READ CUSTOMER DOCUMENT` → `pdf`

`CREATE PRODUCT DEMO` → `video`

`GENERATE VOICEOVER` → `audio`

The router decides which configured provider should handle the step and which providers are valid fallbacks.

## Security boundary

The registry contains endpoints and environment-variable names only. It contains **no API keys**. Customer-facing apps must call an IZAKHONO-controlled backend/worker rather than receiving provider credentials.

## Source

The Reel's underlying directory can be inspected at `https://github.com/golapkamal/awesome-free-llm-apis` and `https://freellm.net/models/`. Current data should be re-verified before any production claim.

## Principle

> **Don't buy intelligence for every task. Route intelligence intelligently.**

IZAKHONO owns the routing policy and orchestration layer; providers remain replaceable.
