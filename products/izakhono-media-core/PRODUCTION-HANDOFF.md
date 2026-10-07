# IZAKHONO Media Core — Production Handoff

This document is the final handoff contract between the repository and the owned Media Core node. It deliberately contains **no secrets**.

## 1. Owned node contract

The production node must provide:

- Linux host with Docker Engine + Docker Compose plugin
- persistent storage for `products/izakhono-media-core/data`
- public DNS name for the control plane and media endpoints
- TLS termination for customer-facing HTTPS/HLS/WebRTC surfaces
- firewall rules allowing only the required media/control ports
- SSH access for the controlled deployment workflow
- backup target for channel metadata, schedules, recordings and configuration

## 2. Required deployment secrets

Configure these as protected CI/environment secrets; never commit them:

- `MEDIA_CORE_HOST`
- `MEDIA_CORE_SSH_USER`
- `MEDIA_CORE_SSH_PRIVATE_KEY`
- `MEDIA_CORE_SSH_KNOWN_HOSTS`
- `MEDIA_ADMIN_TOKEN`
- `MEDIA_PUBLIC_HOST`

Optional future secrets:

- CDN credentials
- object-storage credentials
- payment-provider credentials
- DRM credentials
- monitoring/alerting credentials

## 3. Production gates

The deployment is not considered live until all of these are positively verified:

1. control-plane health
2. MediaMTX health
3. authenticated RTMP ingest
4. authenticated SRT ingest
5. HLS playback
6. WebRTC playback
7. schedule and EPG validation
8. recording and persistent-storage validation
9. TLS and secret validation
10. backup/restore validation
11. paid-channel provisioning end-to-end test

## 4. Security rules

- Do not use development tokens in production.
- Do not expose MediaMTX admin/API endpoints publicly unless explicitly protected.
- Do not place private keys, tokens, payment credentials or customer secrets in Git.
- Do not call a release deployed until the health and smoke-test gates pass.
- Do not represent a Cloudflare control-plane deployment as proof that the MediaMTX media plane is live.

## 5. Rollback

A failed release must leave the previous known-good container/image available for rollback. Never destroy persistent channel data as part of a routine application deployment.

## 6. Go-live evidence

Record, at minimum:

- deployed Git commit SHA
- deployment timestamp
- node hostname
- health endpoint result
- MediaMTX health result
- ingest test result
- HLS playback result
- WebRTC playback result
- EPG result
- recording result
- backup/restore result
- paid provisioning result

Only after this evidence exists should the system be described as production-live.
