# YHVH Broadcast Cloud v1

**Authority:** IZAKHONO  
**Station:** YHVH GOSPEL TV  
**Purpose:** turn the existing YHVH playout/encoder software into a persistent broadcast runtime with an HLS origin and automatic recovery.

## Architecture

`CONTENT VAULT -> RIGHTS/QC/TERRITORY GATE -> YHVH SERVER + FFmpeg -> HLS ORIGIN -> CDN/EDGE -> YHVH PLAYER`

Optional authorised distribution:

`FFmpeg -> RTMP/RTMPS -> authorised platform`

## Services

- `yhvh-tv`: station API, control centre, content vault gate, playout and FFmpeg broadcast runtime.
- `origin`: NGINX HLS origin/reverse proxy. Exposes port 80 and serves `/hls/playlist.m3u8` and media segments.
- `supervisor`: polls the station broadcast state and restarts the encoder only when the station has cleared, QC-passed, territory-approved media. It never bypasses rights controls.

## Persistent storage

- `./vault` is the physical IZAKHONO content vault.
- `./data` stores broadcast manifest, HLS segments, station state and audit data.
- Back up both directories. Do not store secrets in either directory.

## Activation

1. Provision an IZAKHONO-controlled Linux/Docker host with persistent storage and FFmpeg.
2. Copy `.env.example` to `.env` and set a strong `YHVH_CONTROL_TOKEN`.
3. Place legitimately cleared Gospel media in `./vault`.
4. Register each item in the owner Control Center and record rights evidence.
5. Run technical QC and set QC PASS only after inspection.
6. Clear the active territory (default ZA) and verify the physical media path.
7. Start the stack with `docker compose up -d --build`.
8. Confirm `/health`, `/api/broadcast`, and `/hls/playlist.m3u8` from an independent client.
9. Put the HLS origin behind the selected lawful TLS/CDN edge. The origin must remain reachable by the edge.
10. Configure an authorised RTMP/RTMPS destination only when a real platform credential has been provisioned as a secret.

## Fail-closed rules

The station does **not** start an encoder without:

- rights `CLEAR` with evidence;
- QC `PASS`;
- active territory clearance;
- media physically present inside the vault;
- supported video format;
- safe vault path.

The supervisor only restarts an encoder that already has an approved input set. It cannot create rights, licences, territory permission or media.

## Public-live definition

YHVH is considered **LIVE** only when all are independently verified:

1. FFmpeg encoder process is running;
2. HLS playlist exists and is updating;
3. media segments are playable;
4. an independent client can retrieve the stream through the public TLS/CDN route;
5. the public player can play the stream.

A deployed dashboard alone is not LIVE.

## Security

- Keep `.env` private.
- Never commit RTMP keys, passwords or private credentials.
- Use TLS at the public edge.
- Restrict owner control endpoints to authenticated operators.
- Keep the origin private to the CDN where practical.
- Rotate the control token if exposed.
- Keep audit records for broadcast start/stop and content decisions.

## Commercial expansion after stable broadcast

Once the core stream is stable, add in this order: CDN analytics -> ad decision/insertion -> audience analytics -> FAST/CTV feeds -> mobile/Smart TV apps -> creator revenue reporting.
