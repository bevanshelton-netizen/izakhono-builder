# IZAKHONO STREAM Playback Control V1

The control-plane playback path is now defined as:

`POST /v1/tenants/{tenantId}/playback-sessions` → tenant validation → identity → entitlement → rights window → device policy → HLS playback resolution → short-lived playback session → audit evidence.

The control boundary returns a manifest reference and short-lived playback token only after all gates pass. It never exposes origin credentials or DRM secrets.

## KORA reference path

KORA NETWORK uses the same tenant-isolated contract. The reference vector in `kora-playback-control-v1.json` resolves an authorized viewer to the reference HLS master playlist.

## Production gate

This is a deterministic control-plane contract and reference implementation. It does **not** prove production playback, real HLS packaging, DRM licensing, CDN delivery, storage durability, or live streaming. Those remain acceptance gates before publication.
