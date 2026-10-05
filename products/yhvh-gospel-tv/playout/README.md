# YHVH 24/7 Playout Engine

IZAKHONO-owned-first playout control for YHVH GOSPEL TV.

## What it does

- Reads a deterministic station playlist.
- Tracks current/next playout state.
- Distinguishes broadcast-ready media from content-vault placeholders.
- Provides a failover model that holds the last good item or uses a station slate.
- Generates an FFmpeg command for an authorised source-to-RTMP/FLV contribution path.
- Keeps media binaries outside Git; the content vault is mounted at runtime.

## Broadcast pipeline

`CONTENT VAULT -> RIGHTS GATE -> QC -> PLAYLIST -> PLAYOUT -> FFmpeg/Encoder -> HLS/RTMP/SRT -> AUTHORISED DISTRIBUTION`

A playlist entry marked `REQUIRES_CONTENT` is not treated as broadcast-ready. Rights, territory, safeguarding and editorial approval remain mandatory gates.

## Runtime

Set `YHVH_CONTENT_VAULT` to a local/owned media directory. Configure an authorised output endpoint separately; never commit stream keys or credentials.

The engine is an orchestration component. It does not manufacture rights, licences or programme media.
