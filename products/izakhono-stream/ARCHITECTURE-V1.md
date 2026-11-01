# IZAKHONO STREAM V1 — Architecture

## 1. Control plane

The control plane is the authoritative business layer:

`STREAM CONTROL → Provisioner → Release Registry → Runtime Fabric`

It owns tenant configuration, catalogue metadata, channel schedules, rights, entitlements, plans, app manifests, deployment state and audit evidence.

## 2. Media plane

`INGEST → OBJECT STORAGE → TRANSCODE → PACKAGE/DRM → ORIGIN → EDGE/CDN → PLAYER`

The media plane is adapter-based. No customer-facing business logic is allowed to depend directly on a single media vendor.

### Required media capabilities

- HLS and DASH delivery
- adaptive bitrate ladders
- VOD transcoding
- live channel ingest
- live-to-VOD where supported
- captions/subtitles
- thumbnails/posters
- DRM integration
- signed playback URLs/tokens
- content rights windows
- CDN authorization

A reference implementation may use managed media services while the owned runtime is being expanded. The same release contract must remain portable.

## 3. Security plane — FORTRESS

`IDENTITY → ENTITLEMENT → PLAYBACK TOKEN → DRM LICENSE → DEVICE POLICY → AUDIT`

Security requirements:

1. Never expose origin media directly when protected playback is required.
2. Generate short-lived playback authorization.
3. Enforce tenant and entitlement boundaries server-side.
4. Keep provider credentials and DRM secrets server-side.
5. Record security and playback decisions for audit.
6. Support geo and device restrictions where the content contract requires them.

## 4. Monetisation

V1 data model supports:

- FREE
- SVOD
- TVOD
- PPV
- AVOD/FAST
- HYBRID

Payment adapters are separate from entitlement logic. A successful payment creates an entitlement through a verified payment event; a payment provider must never become the source of truth for catalogue or access state.

## 5. App factory

The app layer consumes a tenant release manifest rather than duplicating business logic per platform.

`Tenant Manifest → platform adapter → branded application`

Target surfaces:

- Web/PWA
- Android
- iOS
- Android TV / Google TV
- Samsung TV
- LG webOS
- VIDAA
- Roku
- Fire TV
- Apple TV

The first V1 milestone is the manifest and contract system. Store submission and physical-device certification remain separate evidence gates.

## 6. Provisioning state machine

```text
REQUESTED
  ↓
APPROVED
  ↓
TENANT_CREATED
  ↓
BRAND_CONFIGURED
  ↓
CATALOGUE_READY
  ↓
CHANNELS_CONFIGURED
  ↓
MONETISATION_CONFIGURED
  ↓
SECURITY_CONFIGURED
  ↓
MEDIA_VALIDATED
  ↓
APP_MANIFESTS_BUILT
  ↓
RELEASE_CANDIDATE
  ↓
ACCEPTANCE_TESTED
  ↓
PUBLISHED
```

Any failed stage produces an explicit blocked state and evidence record; it must not silently report the service as live.

## 7. Reference tenant: KORA NETWORK

KORA is the first reference tenant for the factory. Its existing OTT capabilities—entitlement-aware sessions, signed playback URLs, player handoff and analytics—should be migrated into the reusable contracts rather than rebuilt as a separate platform.

## 8. Runtime strategy

Preferred path:

`CODE / Forge → immutable release → IZAKHONO Runtime Fabric → FORTRESS → EDGE/TLS → IZAKHONO DNS`

External media/CDN capacity is permitted as a reversible adapter until owned media infrastructure passes the required public verification gates.
