# IZAKHONO STREAM — Media Engine V1

## Objective

Turn a tenant asset into a controlled, measurable playback artifact while keeping the media layer replaceable. The media engine is an adapter boundary, not a lock-in to a particular CDN, transcoder, storage vendor, or DRM service.

## Pipeline

`INGEST → VERIFY → TRANSCODE → PACKAGE → PROTECT → PUBLISH → RESOLVE PLAYBACK → ANALYTICS`

### 1. Ingest
- Create an asset-scoped ingest request.
- Verify upload completion, MIME type, size, checksum, and tenant ownership.
- Never expose storage credentials to the client.

### 2. Transcode
- Produce a deterministic rendition ladder.
- Record codec, dimensions, bitrate, duration, and job evidence.
- Failed jobs become `BLOCKED`; they do not silently publish partial output.

### 3. Package
- Produce HLS and, where supported, DASH outputs.
- Generate a master/multivariant playlist and media playlists.
- Preserve source-to-rendition lineage for audit and reprocessing.

### 4. Protect
- Apply tokenized playback and the tenant's declared DRM policy.
- DRM secrets and signing material remain server-side.
- FORTRESS controls entitlement and device policy before a playback grant is issued.

### 5. Publish
- Publish only after media validation passes.
- Runtime receives immutable release artifacts rather than mutable tenant configuration.

### 6. Playback
- Client requests playback through the control plane.
- Control plane validates identity, entitlement, rights window, device policy, and release state.
- Media adapter resolves the manifest/grant.
- Client receives only a short-lived playback response.

### 7. Analytics
- Emit normalized playback events independently of the media provider.
- Track starts, failures, buffering, bitrate changes, completion, and heartbeats.
- Keep tenant analytics logically isolated.

## Ownership-first strategy

The media adapter contract permits an IZAKHONO-owned storage/transcoding/packaging/CDN implementation to become the primary provider later. External providers can remain reversible fallback adapters during migration. Tenant contracts and the control plane do not change when the underlying media provider changes.

## Current status

This wave establishes the contracts and validation gate. It does **not** claim that an operational transcoder, DRM service, CDN, or production playback endpoint has been deployed. Those require runtime implementation and evidence.
