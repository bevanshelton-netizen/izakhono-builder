# IZAKHONO CONNECT — Owned-First Infrastructure

CONNECT is designed around IZAKHONO-owned infrastructure first.

## Service planes

- `core` — authentication, profiles, conversations and control-plane APIs
- `realtime` — messaging presence and call signalling
- `media` — private attachment/object storage
- `turn` — WebRTC NAT traversal
- `push` — notification gateway
- `edge` — optional delivery/cache edge
- `backup` — recovery and continuity

## Rules

1. Owned infrastructure is the primary runtime.
2. External providers are reversible fallbacks, not architectural dependencies.
3. Secrets and service credentials never enter client code.
4. Private media remains private and is accessed through short-lived authorization.
5. Calls are not considered production-grade until TURN is configured and tested across restrictive NATs.
6. End-to-end encryption is not claimed until an audited protocol/library is integrated and tested.
7. Every infrastructure node must expose health/heartbeat information to the CONNECT control plane.

## Current control plane

Supabase project `yfawrenhudjomhnglfhq` contains the CONNECT infrastructure registry and hardened RPC boundary. Node registration is intentionally not exposed to ordinary authenticated clients.

## Next owned-runtime services

- self-hosted realtime gateway
- self-hosted TURN/coturn service
- owned notification gateway
- owned media delivery layer
- health monitoring and failover controller
