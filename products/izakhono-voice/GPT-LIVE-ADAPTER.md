# IZAKHONO VOICE — GPT-Live streaming adapter

## Purpose

`src/gpt-live-session-factory.ts` implements the provider-neutral `VoiceStreamSessionFactory` contract using GPT-Live as one replaceable real-time speech provider.

The adapter uses the server-to-server WebSocket endpoint:

`wss://api.openai.com/v1/live/sessions`

The API key is supplied at runtime and is passed only to the host-provided `GptLiveSocketConnector`. No browser/client key, hard-coded credential, SDK dependency, or fixed hosting runtime is introduced.

## Audio path

Twilio Media Streams and GPT-Live both support mono G.711 μ-law (PCMU) at 8 kHz. IZAKHONO configures GPT-Live with `audio/pcmu` at `8000` and forwards raw base64-decoded bytes in both directions. No PCM conversion or sample-rate conversion is required.

- Twilio inbound media → IZAKHONO bridge → `session.input_audio.append`
- GPT-Live `session.output_audio.delta` → IZAKHONO session → Twilio outbound media
- GPT-Live `session.closed` → final usage callback and socket cleanup

## Runtime contract

The hosting runtime must implement `GptLiveSocketConnector` using its supported WebSocket client. The connector accepts a URL and server-only headers, then returns a socket implementing message, close, and error subscriptions. This keeps Node, container, and edge-runtime socket implementations interchangeable.

Runtime configuration:

- `IZAKHONO_GPT_LIVE_API_KEY` — secret; runtime secret store only
- `IZAKHONO_GPT_LIVE_MODEL` — optional; defaults to `gpt-live-1`
- `IZAKHONO_GPT_LIVE_VOICE` — optional; defaults to `marin`
- `IZAKHONO_VOICE_INSTRUCTIONS` — required, tenant-approved system instructions

Create one session per authorised call. Use the bridge's mandatory server-side call registry check before constructing the provider session. Attribute usage and transcript events using the canonical tenant ID returned by IZAKHONO, never the caller's custom parameters.

The adapter waits for `session.started` before returning a ready session. On call completion it sends `session.close`, waits for `session.closed`, captures final usage, and closes the socket. An incomplete finalization is not silently recorded as a successful close.

## Provider independence and governance

GPT-Live is an adapter, not the IZAKHONO system of record. IZAKHONO retains call state, tenant/customer data, prompts/instructions, authorization, audit events, usage attribution, and business rules. Another real-time voice provider can implement the same session factory interface without changing the Twilio bridge.

Before production use, configure consent and recording disclosures, retention/deletion rules, data-processing terms, regional/privacy requirements, per-tenant concurrency and spend limits, abuse controls, and an operational human-handoff path.

## Status

The adapter and mock-socket tests are engineering code. The host WebSocket connector, real API credentials, deployed WSS ingress, and live carrier/model calls have not yet been configured or verified. **IZAKHONO VOICE remains NOT LIVE.**

## API references

- [GPT-Live WebSocket connection and event lifecycle](https://developers.openai.com/api/docs/guides/voice-websockets)
- [GPT-Live session events and audio formats](https://developers.openai.com/api/reference/cli/resources/live)
