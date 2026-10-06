# YHVH GOSPEL TV — LIVE ACTIVATION RUNBOOK

## Objective
Move the station from configured software to a verified live broadcast without bypassing rights, licensing, territory, or platform controls.

## Required physical runtime
- IZAKHONO-controlled host running the YHVH Docker image.
- FFmpeg installed (included by the Dockerfile).
- Persistent `YHVH_CONTENT_VAULT`.
- Persistent HLS directory.
- Strong `YHVH_CONTROL_TOKEN`.
- At least one real video asset that is READY under the content-vault gate.
- An authorized distribution destination and credential if external distribution is required.

## Activation order
1. Start the container.
2. Confirm `/health` reports the service and broadcast runtime.
3. Confirm `/api/broadcast` reports at least one approved input.
4. Authenticate `/broadcast` with the owner token.
5. Start the encoder.
6. Confirm `hlsReady` and `/hls/playlist.m3u8`.
7. Verify playback from an independent client/network.
8. If external distribution is authorized, configure `YHVH_RTMP_URL` as a secret and verify the destination receives the signal.
9. Record activation timestamp, encoder PID, destination, operator and verification result in the audit trail.

## Non-negotiable
Do not mark the station LIVE merely because the web UI is deployed. LIVE means a real encoder process is running and an independently verified media stream is playable.

Do not place stream keys, passwords or private credentials in Git.
