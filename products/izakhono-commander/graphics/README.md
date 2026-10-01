# IZAKHONO COMMANDER GRAPHICS v0.1

This module adds an authenticated graphical remote-desktop channel to IZAKHONO COMMANDER.

## Design

- The COMMANDER server remains the control plane.
- A paired desktop agent owns the actual screen-capture and input capabilities.
- Browser operators receive a live desktop stream and send mouse/keyboard events over an authenticated channel.
- WebRTC is the preferred media transport; the control plane supplies short-lived session authorization and signaling.
- No desktop credential is stored in the browser.
- Screen/input control is disabled until the operator explicitly starts a session.
- Every session start/stop and privileged input action is auditable.

## Agent abstraction

The native agent implements:

- captureScreen() -> encoded video frames
- getDisplays()
- getPointer()
- movePointer(x,y)
- mouseButton(button,down)
- mouseWheel(deltaX,deltaY)
- keyEvent(code,down)
- clipboardRead()/clipboardWrite() only when explicitly enabled
- lock()/unlock() session lifecycle

The implementation must use OS-native APIs or a reviewed cross-platform library. The server never executes shell commands to obtain screen data.

## Security

A graphical session is high privilege. Production requirements:

1. Pairing plus operator authentication.
2. Short-lived per-session token.
3. Explicit device approval.
4. Device revocation.
5. HTTPS/WSS.
6. WebRTC DTLS/SRTP.
7. Session timeout and inactivity timeout.
8. Visible local-agent indicator while a session is active.
9. Local user can terminate a session.
10. Audit session lifecycle and input-control events.
11. Clipboard disabled by default.
12. File transfer disabled by default.
