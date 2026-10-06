# YHVH 24/7 Playout and Broadcast Engine

IZAKHONO-owned-first broadcast control for YHVH GOSPEL TV.

## Broadcast path

`CONTENT VAULT -> RIGHTS/TERRITORY GATE -> TECHNICAL QC -> BROADCAST INPUT MANIFEST -> FFmpeg -> HLS / optional RTMP -> AUTHORISED DISTRIBUTION`

The station playlist may contain rotations that require content. Those placeholders are not treated as broadcast-ready media.

## Encoder gate

`broadcast-inputs.json` is the encoder authority. Every item must have:

- `status: READY`
- `rightsStatus: CLEAR`
- `qcStatus: PASS`
- a matching territory in `territories`
- a media path that exists inside `YHVH_CONTENT_VAULT`

An empty manifest means the encoder cannot start. This is deliberate: free, submitted, paid, or partner content is not automatically broadcast-cleared.

## Runtime

`broadcast-runtime.mjs` starts FFmpeg only after the gate passes. It produces HLS at `/hls/playlist.m3u8` and can optionally tee the same encoded feed to `YHVH_RTMP_URL`.

Owner control routes require `YHVH_CONTROL_TOKEN`:

- `GET /api/control/broadcast`
- `POST /api/control/broadcast/start`
- `POST /api/control/broadcast/stop`

A public health/status response exposes operational state but never exposes the owner token.

## Production requirements

- FFmpeg is installed by the Docker image.
- No stream keys or credentials belong in Git.
- Configure output credentials through the runtime environment or secret manager.
- Keep territory rights and technical QC records current.
- Activate external distribution only after the relevant partner/platform authorization exists.
- Media binaries remain outside Git and are mounted through `YHVH_CONTENT_VAULT`.
