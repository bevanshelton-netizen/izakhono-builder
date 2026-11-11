# IZAKHONO VOICE™ — Call-Centre Engine

Provider-neutral call-centre foundation for IZAKHONO VOICE™.

This product uses the public Microsoft `call-center-ai` project as an architectural reference for real-time voice conversations, structured case data, RAG, reminders, post-call synthesis and human handoff. It does **not** make Microsoft/Azure the IZAKHONO system of record or permanent infrastructure dependency.

## Design rule

**IZAKHONO owns the orchestration, customer/case state, Caller ID policy, business rules, security, APIs and audit trail. Telephony, speech and LLM providers are replaceable adapters.**

## First implementation surface

- Inbound and outbound call orchestration
- Built-in Caller ID context
- Customer/case schema
- Real-time conversation events
- RAG/knowledge lookup boundary
- Human-agent transfer boundary
- SMS follow-up boundary
- Reminder/callback boundary
- Post-call synthesis and action extraction
- Provider-neutral LLM and telephony interfaces
- FORTRESS audit/security hooks

## Provider adapter model

```text
PHONE/SIP PROVIDER
       ↓
IZAKHONO VOICE GATEWAY
       ↓
CALL SESSION + CALLER ID
       ↓
VOICE ORCHESTRATOR
  ↙       ↓        ↘
RAG     LLM       BUSINESS TOOLS
  ↓       ↓        ↓
CASE STORE / CRM / SMS / CALLBACKS
       ↓
FORTRESS AUDIT
```

The current owned-first voice path uses a local ASR service, an Ollama-compatible local language-model endpoint, and IZAKHONO's existing Kokoro speech runtime. Twilio is a replaceable carrier adapter; local model and speech services remain replaceable behind IZAKHONO interfaces.

## Status

**Engineering foundation created — not production deployed.** Production activation still requires telephony credentials/numbers, a reachable IZAKHONO runtime, security review, data-protection controls, end-to-end call testing and acceptance evidence.


## Owned local voice path

```text
TWILIO MEDIA STREAM (8 kHz μ-law)
        ↓
IZAKHONO VOICE GATEWAY
        ↓
LOCAL ASR (faster-whisper)
        ↓
LOCAL REASONING (Ollama-compatible runtime)
        ↓
LOCAL SPEECH (Kokoro)
        ↓
μ-law audio frames → caller
```

The first implementation is turn-based: it detects a pause, transcribes the caller's utterance, generates a response, and synthesizes audio. Full-duplex interruption/barge-in, advanced noise suppression and multi-party handling are later milestones. Local models must be approved, staged and benchmarked before commercial use.
