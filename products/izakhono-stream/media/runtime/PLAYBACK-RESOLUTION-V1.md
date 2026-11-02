# IZAKHONO STREAM — Playback Resolution V1

## Purpose

This boundary connects the validated HLS output contract to the control-plane playback session without exposing origin credentials or long-lived media URLs.

## Resolution sequence

1. Identify tenant.
2. Validate identity.
3. Validate entitlement and rights window.
4. Validate device policy.
5. Resolve the tenant/asset HLS master playlist through the MediaAdapter.
6. Return a short-lived, authorization-protected playback reference.
7. Record resolution evidence for the release gate.

## KORA NETWORK reference

The reference tenant is `kora-network`. The reference resolver produces a deterministic `ref://` playlist URI only. It does not represent a live CDN endpoint, DRM license service, origin, storage bucket, or production player.

## Production gate

A production implementation must replace the reference adapter with verified media storage/origin, HLS packaging, DRM/license services, signed playback authorization, CDN/edge delivery, observability, backup/restore and failover evidence.
