# IZAKHONO VOICE — Twilio Media Streams bridge

## What this module does

`src/twilio-media-stream-bridge.ts` is a per-WebSocket protocol adapter. It translates Twilio Media Streams events into a provider-neutral `VoiceStreamSession`. The deployment runtime supplies the WebSocket upgrade and socket lifecycle; this module does not open a listening port.

- Inbound caller audio is decoded from base64 into mono G.711 μ-law frames at 8 kHz.
- Outbound session audio is encoded into Twilio `media` messages.
- `mark`, `dtmf`, `stop`, and `connected` events are handled or forwarded.
- Payload sizes, audio format, stream IDs, and DTMF values are checked.
- A server-side `authorizeStart` callback is mandatory. It must resolve the provider CallSid to an existing IZAKHONO call and tenant. Client-supplied custom parameters are untrusted hints and must never determine tenant ownership.

## Runtime integration contract

1. Expose a public `wss://` endpoint reachable by Twilio.
2. Before accepting the WebSocket upgrade, validate Twilio's `X-Twilio-Signature` using the exact canonical public request URL and the provider's documented signature-validation procedure. Do not trust an unvalidated Host or forwarded-host header when constructing that URL.
3. Perform the WebSocket upgrade using the chosen runtime's supported WebSocket server API.
4. Instantiate `TwilioMediaStreamBridge` per accepted socket. Implement `authorizeStart` as a server-side call-registry lookup that checks the Twilio CallSid, expected call state, tenant ownership, and the short-lived stream association issued by IZAKHONO.
5. Route each text frame to `handleMessage`; call `close` on socket close/error. Do not create a speech session until authorization succeeds.
6. Supply a `VoiceStreamSessionFactory` that connects to the selected real-time speech/model service. The factory owns buffering, turn detection, interruption/barge-in, latency controls, usage metering, and audio conversion where required.
7. Apply call duration, concurrency, tenant isolation, frame limits, rate limits, and resource limits at the runtime boundary.

## Important boundaries

The existing `VoiceAdapter` is a batch transcribe/synthesize contract, not a real-time streaming engine. This bridge deliberately does not pretend otherwise: a streaming session factory and an actual reachable WSS runtime endpoint are still required. The existing form-webhook signature helper is not a substitute for validating the WebSocket upgrade request using Twilio's exact request-validation rules.

No live number or production call has been verified. Keep IZAKHONO VOICE marked **NOT LIVE** until the streaming speech/model adapter, authenticated runtime deployment, security/privacy review, and end-to-end inbound/outbound audio tests are complete.
