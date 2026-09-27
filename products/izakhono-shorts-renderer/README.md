# IZAKHONO SHORTS RENDERER

Native owner-hosted renderer for **IZAKHONO SHORTS FACTORY**.

It turns the `izakhono.shorts.render.v1` job contract into a real MP4 without Higgsfield or another required cloud video provider.

## Owned production path

```text
IZAKHONO SHORTS FACTORY (9710)
  -> worker
  -> IZAKHONO SHORTS RENDERER (9721)
     -> local ComfyUI (8188) for original vertical scene keyframes
     -> local/owned speech adapter when configured
        -> deterministic espeak-ng local fallback
     -> owned video adapter when configured (e.g. Wan-compatible service)
        -> deterministic FFmpeg pan/zoom motion fallback
     -> FFmpeg scene assembly + AAC audio
     -> VTT captions + optional burned captions
     -> local MP4/manifest assets
```

External generation is not required. No third-party provider is hard-coded.

## What v0.1 produces

- original 9:16 scene keyframes from the existing owner-selected ComfyUI checkpoint;
- one narration track per scene;
- a finished H.264/AAC MP4;
- VTT captions and optional burned-in captions;
- an immutable render manifest recording image/speech/motion routes;
- local HTTP asset delivery for the Shorts worker/publisher handoff.

The default motion mode uses a cinematic push-in/pan over generated frames, so it can create a complete video before a full local text-to-video model is installed. When an owned video endpoint is configured, the same renderer automatically uses that endpoint per scene and keeps FFmpeg as the fallback.

## Privacy / control

- no telemetry;
- no advertising IDs;
- no behavioural tracking;
- renderer binds to the owner host;
- render endpoint requires `x-izakhono-shorts-key`;
- secrets remain in `/etc/izakhono/apps/izakhono-shorts-renderer.env`;
- no raw prompt is sent to an external service by this renderer;
- publishing remains a separate deliberate workflow;
- kids metadata comes from the upstream Shorts plan and is not stripped.

## NODE 01

The one-click Windows launcher at repository root is:

`START-IZAKHONO-SHORTS-NODE01.cmd`

It now installs/verifies this renderer in Ubuntu/WSL first, retrieves the machine-local renderer secret, then starts the Shorts API and worker with that secret.

Direct WSL install:

```bash
sudo bash products/izakhono-shorts-renderer/install-node01.sh /tmp/izakhono-shorts-renderer-report.json
```

Health:

`GET http://127.0.0.1:9721/healthz`

A 200 response requires:

1. renderer internal key;
2. ComfyUI reachable;
3. configured checkpoint visible to ComfyUI;
4. FFmpeg available;
5. an owned speech route or local espeak-ng fallback.

The NODE01 evidence gate additionally requires a visible NVIDIA GPU before it reports `ready=true`.

## Optional owned adapters

The base renderer is functional without these. They are extension points:

- `IZAKHONO_SHORTS_SPEECH_URL` — owned speech generation service. Expected `POST /api/v1/generate` returning an `audio.data_url`, `audio.url`, `data_url` or `url`.
- `IZAKHONO_SHORTS_VIDEO_URL` — owned scene animation service. Expected `POST /api/v1/generate` returning a `video.data_url`, `video.url`, `data_url` or `url`.

This is where a local Kokoro-class speech service or Wan-compatible video service can be attached without changing the Shorts Factory API.

## Model licence rule

The installer does not silently download model weights or accept third-party licences. The exact checkpoint/model must be owner-approved, with source, licence and checksum recorded before commercial production.

## Launch truth

Software CI proves the contract, validation, captions and code integrity. It cannot prove that physical NODE01 has a suitable GPU, checkpoint, model quality or acceptable generation latency. The product is only called live-generating after the NODE01 evidence report says `ready=true` and an end-to-end render returns a reachable `output.mp4`.
