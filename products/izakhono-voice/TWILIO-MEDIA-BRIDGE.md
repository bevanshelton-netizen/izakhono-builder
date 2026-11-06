# IZAKHONO VOICE — Twilio Media Streams bridge

## What this module does

`src/twilio-media-stream-bridge.ts` is a per-WebSocket protocol adapter. It handles Twilio JSON events and translates bidirectional media frames to a provider-neutral `VoiceStreamSession`. It does not open a listening port or perform a WebSocket upgrade; the deployment runtime supplies the socket and creates one bridge instance for each accepted connection.

- Inbound caller audio is decoded from base64 into mono G.711 μ-law frames at 8 kHz.
- Outbound session audio is encoded and emitted as Twilio `media` messages.
- `mark`, `dtmf`, `stop`, and `connected` events are handled or forwarded.
- Session resources are closed when the stream stops or a protocol/runtime error occurs.

## Runtime integration contract

1. Expose a public `wss://` endpoint reachable by Twilio.
2. Perform the WebSocket upgrade using the chosen runtime's supported WebSocket server API.
3. Associate the stream with the expected tenant and call using a short-lived, server-issued, integrity-protected stream token. Do not trust caller-supplied tenant IDs or query parameters by themselves.
4. Validate the Twilio call/stream association against the call created by the IZAKHONO call orchestrator before creating a session.
5. Instantiate `TwilioMediaStreamBridge` per socket, route each text frame to `handleMessage`, and call `close` on socket close/error.
6. Supply a `VoiceStreamSessionFactory` that connects to the selected real-time speech/model service. The factory owns buffering, turn detection, interruption/barge-in, latency controls, usage metering, and audio conversion where required.
7. Apply call duration, concurrency, tenant isolation, and resource limits at the runtime boundary.

## Important boundary

The existing `VoiceAdapter` is a batch transcribe/synthesize contract. It is not a real-time streaming engine. This bridge deliberately does not pretend otherwise: a streaming session factory still has to connect the bridge to a real-time speech/model pipeline. The runtime endpoint must also be deployed and tested with actual inbound and outbound audio before IZAKHONO VOICE can be described as live.
