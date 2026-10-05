# YHVH Gospel TV Station Engine

IZAKHONO-owned-first software for bringing YHVH GOSPEL TV to life.

## What is built

- Public 24/7 TV experience with live-player integration.
- Deterministic 24-hour Gospel schedule / EPG.
- Now-playing and next-programme API.
- Owner Control Room with automation and emergency-slate controls.
- Public Creator Space with rate-limited intake.
- Persistent local submission/audit state.
- Health endpoint for owned-infrastructure probing.
- Optional live HLS/embed source through `YHVH_LIVE_URL`.
- Owner controls protected by `YHVH_CONTROL_TOKEN`.

## Run

```bash
cd products/yhvh-gospel-tv
YHVH_CONTROL_TOKEN='use-a-long-random-secret' YHVH_LIVE_URL='https://authorised.example/live' npm start
```

Open `/` for the public station, `/control` for owner operations, and `/creator` for creator intake.

## Important

The software does not manufacture broadcast rights or programme media. A real channel feed requires an authorised live/stream source and content whose rights, territory, language, safeguarding and editorial checks have passed. Until `YHVH_LIVE_URL` is configured, the public experience honestly presents the station as ready for feed activation rather than pretending video is live.

This product is designed to sit beneath the existing YHVH rights, language-routing, creator, commercial and distribution policies.
