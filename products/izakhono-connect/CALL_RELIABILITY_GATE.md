# IZAKHONO CONNECT — Call Reliability Gate

This gate defines the conditions required before browser voice/video calling is treated as production-ready.

## Required client behavior

- Queue remote ICE candidates until `setRemoteDescription()` has completed.
- Replay recent call signals after subscription recovery or late join.
- Treat `connected` as active only after the peer connection reaches a connected state.
- Detect `failed`, `disconnected`, and `closed` peer states and clean up deterministically.
- End unanswered ringing calls after a bounded timeout and mark them missed through the authorized call RPC.
- Prevent a second active call from being created while a call is already active.
- Stop all local media tracks and remove realtime channels on every exit path.
- Never expose TURN credentials to browser source code.

## Infrastructure activation gate

Calling is not considered telecom-grade until an IZAKHONO-controlled TURN relay is provisioned and tested from restrictive NAT networks. STUN-only operation remains a development/fallback mode.

## Security gate

Private calling must not be described as end-to-end encrypted until an audited protocol/library is integrated and independently verified. WebRTC transport security alone is not sufficient to make that claim.

## Test matrix

1. Same-LAN voice call.
2. Same-LAN video call.
3. Mobile-to-web call.
4. Two mobile networks.
5. Restrictive NAT requiring TURN.
6. Caller closes/reopens connection during ringing.
7. Callee joins after initial signaling and relies on replay.
8. ICE candidates arrive before remote description.
9. Caller hangs up while callee is ringing.
10. Browser/tab reload during an active call.
11. Permission denied for microphone/camera.
12. Network loss and recovery.

A release may only promote the calling layer after these cases pass on real devices and the TURN activation gate is satisfied.