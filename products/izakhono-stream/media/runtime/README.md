# IZAKHONO STREAM Media Runtime V1

The runtime is the execution boundary between the STREAM control plane and media providers.

## Pipeline

`RECEIVED → UPLOAD_VERIFIED → TRANSCODE_QUEUED → TRANSCODED → PACKAGED → PROTECTED → PUBLISHED → PLAYABLE`

Any failed operation moves the job to `BLOCKED` and records evidence. A blocked job cannot silently become playable.

## Ownership-first rule

The runtime depends only on the `MediaAdapter` contract. An IZAKHONO-owned storage/transcoder/origin implementation can therefore replace an external provider without changing tenant or control-plane contracts.

## V1 boundary

This reference implementation provides orchestration and deterministic state transitions. It does **not** claim production transcoding, DRM licensing, CDN delivery, storage, or live playback until concrete adapters are connected and acceptance evidence is recorded.
