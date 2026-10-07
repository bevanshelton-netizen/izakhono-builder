# YHVH GOSPEL TV — Production Broadcast Deployment

## CEO objective

Move YHVH GOSPEL TV from technical validation to a persistent IZAKHONO-controlled broadcast runtime without bypassing rights, territory, licensing, safeguarding or platform controls.

## Production stack

CONTENT VAULT → RIGHTS GATE → TERRITORY GATE → TECHNICAL QC → PLAYLIST/EPG → 24/7 PLAYOUT → FFmpeg → HLS → AUTHORISED CDN/DISTRIBUTION → YHVH PLAYER

## Host requirement

Use a persistent Linux/Docker host controlled by IZAKHONO or an authorised infrastructure provider. The host must provide:

- Docker Engine + Compose
- persistent disk for content and HLS segments
- stable public HTTPS ingress
- sufficient CPU for the selected encoding profile
- monitoring and restart policy
- firewall/security controls
- secrets stored outside Git

## First activation

1. Place only legitimately cleared media in `content-vault/`.
2. Register each item in the broadcast manifest.
3. Set `rightsStatus=CLEAR` only with evidence.
4. Set `qcStatus=PASS` after technical QC.
5. Add the authorised territory.
6. Confirm the file physically exists in the vault.
7. Set `status=READY` only after all gates pass.
8. Set `YHVH_CONTROL_TOKEN` in the host environment.
9. Run `docker compose up -d --build` from this directory.
10. Verify `/health` reports the broadcast runtime and approved input count.
11. Start the encoder from the owner control surface.
12. Verify `/hls/playlist.m3u8` from an independent network/client.
13. Only then record the station as LIVE for that authorised distribution route.

## External distribution

`YHVH_RTMP_URL` is optional and must contain an authorised destination configured as a host secret. Never commit stream keys, passwords or private credentials.

## Fail-closed rules

The encoder must not be treated as broadcast-ready when rights, QC, territory or physical media requirements are missing. A technical stream is not evidence of editorial clearance or worldwide distribution rights.

## Current programme status

The technical validation asset is TEST_ONLY. It must never be represented as the public YHVH Gospel programme service. Replace it with cleared Gospel programming before public launch.
