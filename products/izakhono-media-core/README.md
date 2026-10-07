# IZAKHONO MEDIA CORE

Owned-first live/FAST/OTT media foundation for IZAKHONO.

## MVP

- Channel provisioning API
- Stream key generation
- MediaMTX configuration generation
- RTMP / SRT / HLS / WebRTC endpoints
- Playlist and schedule data model
- 24/7 fallback playlist support
- EPG export
- Health endpoint
- Approval-gated publishing state

## Architecture

`customer -> IZAKHONO PROVISIONER -> MEDIA CORE -> MediaMTX -> HLS/WebRTC -> viewer`

MediaMTX is the media transport/router. It supports publishing and reading RTMP, SRT, WebRTC and HLS, recording/playback, authentication, a control API and metrics. See the official documentation: https://mediamtx.org/docs/kickoff/introduction

## Run

```bash
npm start
```

Environment:

- `MEDIA_CORE_PORT` default `8787`
- `MEDIA_PUBLIC_HOST` default `localhost`
- `MEDIA_ADMIN_TOKEN` required for provisioning mutations
- `MEDIA_DATA_DIR` default `./data`

The API stores control-plane state locally as JSON for the MVP. Production IZAKHONO infrastructure can replace this adapter with the sovereign repository/database without changing the API contract.

## Core endpoints

- `GET /health`
- `GET /api/channels`
- `POST /api/channels`
- `GET /api/channels/:id`
- `POST /api/channels/:id/playlist`
- `POST /api/channels/:id/schedule`
- `POST /api/channels/:id/approve`
- `GET /api/channels/:id/epg.xml`
- `GET /api/channels/:id/stream-config`

Publishing remains approval-gated. The system never claims a channel is live merely because a channel record exists.
