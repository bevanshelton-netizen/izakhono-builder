# IZAKHONO STREAM Control Plane — Data Model V1

The control plane is deliberately provider-neutral. Media URLs, DRM systems, payment processors and CDN identities are adapter data, not business ownership.

## Core entities

### Tenant

`tenant(id, name, status, created_at, updated_at)`

A tenant is a fully isolated branded streaming service.

### Brand

`brand(tenant_id, display_name, logo_uri, primary_color, secondary_color, domain)`

### User / Role

`user(id, tenant_id, external_subject, status)`

`role(user_id, tenant_id, role)`

Roles: `OWNER`, `ADMIN`, `EDITOR`, `PROGRAMMER`, `ANALYST`, `SUPPORT`.

### Asset

`asset(id, tenant_id, title, type, description, poster_uri, duration_seconds, rights_start, rights_end, status)`

Types: `MOVIE`, `EPISODE`, `CLIP`, `LIVE_EVENT`, `AUDIO`.

### Media Rendition

`media_rendition(id, asset_id, protocol, manifest_uri, codec, bitrate, width, height, adapter_id)`

Protocols: `HLS`, `DASH`.

### Channel

`channel(id, tenant_id, name, mode, enabled, epg_adapter_id)`

Modes: `LIVE`, `LINEAR`, `FAST`.

### Programme / Schedule

`programme(id, channel_id, asset_id, starts_at, ends_at, position)`

### Plan

`plan(id, tenant_id, name, model, price_minor, currency, billing_period, active)`

Models: `FREE`, `SVOD`, `TVOD`, `PPV`, `AVOD`, `FAST`.

### Entitlement

`entitlement(id, tenant_id, user_id, asset_id, channel_id, plan_id, source, starts_at, ends_at, status)`

The entitlement engine is authoritative for access. Payment providers only emit verified events that can create/update entitlements.

### Playback Session

`playback_session(id, tenant_id, user_id, asset_id, device_id, drm_system, issued_at, expires_at, status)`

Only short-lived playback authorization is returned to clients.

### Provisioning Run

`provisioning_run(id, tenant_id, state, started_at, completed_at, blocker)`

`provisioning_evidence(id, provisioning_run_id, gate, status, evidence_uri, checked_at)`

### Release

`release(id, tenant_id, version, artifact_digest, status, created_at, published_at)`

A release is immutable once accepted. Runtime nodes execute releases; they do not become the source of truth.

### App Manifest

`app_manifest(id, tenant_id, release_id, platform, version, artifact_uri, status)`

Platforms map to the V1 app factory targets.

## Access rules

1. Every business entity carries `tenant_id` except global adapter/configuration tables.
2. No cross-tenant catalogue, entitlement or playback access is permitted.
3. Playback authorization must re-check rights and entitlement at session creation.
4. Rights expiry must terminate or prevent new playback sessions.
5. Administrative writes require role authorization and audit records.
6. Secrets never live in catalogue or tenant release documents.

## Provider adapters

Provider adapters are isolated behind interfaces:

- `MediaAdapter`: ingest, transcode, package, manifest, delete.
- `DRMAdapter`: license endpoint, key policy, entitlement binding.
- `PaymentAdapter`: webhook verification, transaction lookup, refund/status.
- `CDNAdapter`: publish, invalidate, signed delivery.
- `AppStoreAdapter`: build metadata, signing references, submission state.

This makes the platform portable across providers and supports the IZAKHONO owned-first infrastructure policy.
