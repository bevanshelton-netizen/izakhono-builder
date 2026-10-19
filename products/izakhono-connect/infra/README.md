# IZAKHONO CONNECT — Runtime Service Contract

CONNECT is separated into independently replaceable service planes so the application is not tied to a single hosting vendor.

| Plane | Responsibility | Production requirement |
|---|---|---|
| Core | Auth, profiles, conversations, policy | healthy control plane |
| Realtime | Messages, presence, signalling | persistent realtime transport |
| Media | Private attachments | private object storage + signed access |
| TURN | WebRTC relay | owned coturn node |
| Push | Mobile/web notifications | FCM/APNs/Web Push gateway |
| Edge | Delivery/cache | optional, reversible |
| Backup | Recovery | independent backup/restore |

## Health contract

Every owned node should report:

- node name
- role
- status
- heartbeat timestamp
- region
- software version
- capacity/health metadata

The client must never receive infrastructure secrets or privileged node credentials.

## Failover principle

CONNECT should fail over by service plane. A temporary external edge or TURN provider must never require a rewrite of the application or database model.
