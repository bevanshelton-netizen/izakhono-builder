# YHVH GOSPEL TV — Broadcast Cloud v1

## CEO implementation target

Move YHVH from a software-ready station to a persistent broadcast service using an IZAKHONO-controlled origin, protected public edge, continuous HLS delivery, and a repeatable deployment process.

## Architecture

`CONTENT VAULT → RIGHTS GATE → TERRITORY GATE → TECHNICAL QC → PLAYOUT → FFmpeg → HLS ORIGIN → CADDY/TLS EDGE → PUBLIC PLAYER`

Optional authorised distribution:

`FFmpeg → RTMP/RTMPS destination`

## Infrastructure policy

1. IZAKHONO-owned/controlled runtime first.
2. Public edge may use approved external infrastructure for reach and TLS.
3. External distribution credentials remain outside Git.
4. No content is broadcast merely because it is free, submitted, sponsored, or paid for.
5. The encoder must fail closed when no media satisfies the rights, QC, territory and physical-vault gates.

## Host requirements

- Linux host or equivalent Docker-capable server under IZAKHONO control.
- Docker Engine + Docker Compose.
- Persistent disk for the content vault and HLS state.
- Public DNS A/AAAA record for the broadcast domain.
- Ports 80/443 reachable from the Internet.
- Sufficient outbound bandwidth for the selected video bitrate and audience/origin architecture.

## Deployment

1. Copy `.env.broadcast.example` to `.env.broadcast`.
2. Generate a strong `YHVH_CONTROL_TOKEN` and keep it secret.
3. Point `YHVH_PUBLIC_DOMAIN` at the host.
4. Run `./deploy-broadcast-cloud.sh`.
5. Verify `/health` and `/hls/playlist.m3u8` independently.
6. Put only cleared media into `runtime/content-vault`.
7. Register media through the owner Content Vault controls.
8. Record rights evidence, technical QC PASS and territory clearance.
9. Start the encoder from `/broadcast`.
10. Verify playback from a second network/device before declaring the channel LIVE.

## Scale path

v1: one persistent origin + TLS edge.
v1.1: adaptive bitrate ladder + origin shielding.
v1.2: second origin/failover host.
v1.3: multi-CDN routing.
v1.4: ad insertion + analytics.
v2: FAST/CTV distribution and native mobile/TV applications.

The commercial target is parity with the operational capabilities expected from modern cloud-playout products—continuous linear scheduling, EPG, HLS delivery, CDN integration, multi-screen playback, monetization and redundancy—while retaining IZAKHONO ownership and YHVH-specific rights governance. Modern cloud-playout offerings publicly emphasize these same capability layers. 
