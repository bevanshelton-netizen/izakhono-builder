# IZAKHONO MEDIA CORE — production path

## Control plane

The Media Core API owns channel identity, playlists, schedules, approval state and stream credentials. Its current JSON adapter is deliberately replaceable.

## Media plane

MediaMTX is the first owned-node media plane. It provides protocol conversion and live delivery for RTMP, SRT, HLS and WebRTC, plus recording/playback, authentication, API and metrics.

## Provisioning path

1. Customer creates/purchases a channel.
2. IZAKHONO PROVISIONER creates the channel record.
3. Media Core allocates the channel slug and stream key.
4. MediaMTX receives the corresponding path configuration.
5. Customer uploads media and builds a playlist.
6. Customer schedules programmes.
7. Human owner approves publication.
8. Channel is published to HLS/WebRTC endpoints.
9. EPG is generated from the approved schedule.
10. Analytics and billing are attached to the channel identity.

## Scaling path

- Start with one owned media node.
- Add dedicated media nodes when CPU/bandwidth thresholds require it.
- Put a CDN in front of HLS when audience scale requires it.
- Keep the control plane independent from the media transport layer.
- Keep external CDN/streaming providers replaceable.

## Non-negotiable rules

- Never expose the admin token to viewers.
- Never store customer stream credentials in source control.
- Never call a draft channel live.
- Never report viewer or revenue metrics that were not observed.
- Production authentication must use the organization's identity service/JWT or a secured HTTP authorization service.
