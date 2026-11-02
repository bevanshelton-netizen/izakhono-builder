# IZAKHONO STREAM — HLS Packaging Contract V1

## Purpose

Define the provider-neutral output contract between the media runtime and HLS packaging/origin adapters. This contract is an implementation boundary, not a claim that production packaging is deployed.

## Required output

Every playable VOD or linear asset must expose:

- a master/multivariant HLS playlist URI;
- one or more media playlists/renditions;
- stable rendition metadata including codec, bitrate, width and height where applicable;
- a content-type declaration of `application/vnd.apple.mpegurl` for HLS playlists;
- an immutable asset identifier and tenant identifier;
- a validation record proving playlist structure and required security policy checks.

## Recommended rendition ladder

The runtime must not hard-code a single bitrate. A provider adapter may choose the ladder, but the result must contain enough variants for adaptive delivery appropriate to the content and target devices.

A reference VOD ladder may include 1080p, 720p, 480p and 360p variants when source quality supports them.

## Security boundary

The HLS adapter must support signed or otherwise authorized playback URLs/tokens. DRM metadata is represented by policy and license-provider references; secrets and license credentials never belong in tenant release manifests or media job records.

For protected playback, the adapter must be capable of expressing the applicable DRM systems without exposing keys to the player through the control plane.

## Validation gate

A media job cannot move to `PLAYABLE` unless validation confirms:

1. the master playlist exists;
2. referenced media playlists resolve through the configured origin adapter;
3. at least one valid rendition is present;
4. tenant and asset identifiers match the job;
5. playback authorization is required where the tenant policy requires it;
6. the output is compatible with the declared delivery profile;
7. no raw storage credentials, DRM secrets or origin credentials are returned to the client.

## Ownership-first implementation

The first implementation must be adapter-based:

`MEDIA RUNTIME → HLS PACKAGER ADAPTER → ORIGIN ADAPTER → EDGE/CDN ADAPTER`

IZAKHONO-owned storage, compute, packaging and edge services are preferred when verified. External providers may be used through reversible adapters until the corresponding owned service passes acceptance testing.

## Live channels

Linear channels use the same contract but add playlist rotation, segment freshness, discontinuity handling, programme schedule state and live-window validation. Live publication requires a separate acceptance gate; the existence of this contract does not constitute a live-streaming deployment.

## Evidence required before production publication

- successful ingest evidence;
- successful transcode/package evidence;
- HLS playlist validation;
- playback authorization evidence;
- DRM/license evidence where protected content is enabled;
- origin and edge delivery evidence;
- failure/retry evidence;
- backup/restore evidence;
- DNS/TLS evidence;
- end-to-end playback acceptance across declared device classes.
