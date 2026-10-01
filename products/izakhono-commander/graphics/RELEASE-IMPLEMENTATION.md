# Graphical Commander Release Implementation

The production graphical path is intentionally split into three authenticated layers:

1. Browser console — obtains a short-lived graphics session and opens WSS.
2. COMMANDER broker — authorizes the session, binds it to exactly one enrolled device, relays signalling/control messages, expires inactive sessions, and audits lifecycle events.
3. Native agent — connects outbound from the authorized desktop, captures the selected display, publishes the media track, and applies only authenticated input events for the active session.

## Production transport

Use WebRTC for screen media and a WebRTC DataChannel for input/control. The Rust `webrtc` crate provides `PeerConnection`, local media tracks and bidirectional DataChannels; Tokio is supported by the runtime layer. See the upstream API documentation before upgrading the crate version.

## Release gates

- Build the native agent on Windows, macOS and Linux.
- Verify screen capture permission on the target OS.
- Verify input-control permission on the target OS.
- Establish the browser/agent SDP offer-answer exchange through the broker.
- Exchange ICE candidates through the broker.
- Verify remote video track arrives at the browser.
- Verify pointer, button, wheel and keyboard events arrive at the agent.
- Verify local stop immediately closes the peer connection.
- Verify five-minute inactivity and fifteen-minute maximum session expiry.
- Verify no session can address a different enrolled device.
- Verify session lifecycle and input events are present in the audit log.
- Verify clipboard/file transfer are unavailable unless separately authorized in a future release.

## Handover rule

Do not provide Calvin with a production claim until every release gate above has been exercised on an explicitly authorized machine.
