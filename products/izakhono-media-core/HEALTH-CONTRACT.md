# Health Contract

`GET /health` is intentionally lightweight and reports only control-plane process health.

A future `/api/channels/:id/health` endpoint should combine:

- MediaMTX path state
- ingest freshness
- last segment timestamp
- HLS availability
- WebRTC availability
- recording state
- storage capacity

A channel must not be marked `live` until the media-plane health checks pass.
