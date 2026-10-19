# CONNECT TURN — owned-first WebRTC traversal

This directory defines the self-hosted coturn service required for production-grade voice/video calls.

## Required runtime

- coturn
- UDP/TCP 3478
- TLS 5349
- UDP relay ports (recommended 49152-65535)
- DNS name such as `turn.connect.<owned-domain>`
- long-term credentials generated server-side

## Security requirements

- Never put the TURN secret in browser source.
- Prefer TURN REST credentials with short-lived expiry.
- Restrict management access to the IZAKHONO infrastructure network.
- Enable TLS certificate validation for `turns:`.
- Monitor allocation failures and relay capacity.

## Activation gate

TURN must not be represented as active in CONNECT until a real owned node is provisioned, credentials are injected through secrets, and voice/video has been tested from restrictive NAT networks.

External TURN may be used only as a reversible fallback while the owned node is being provisioned.
