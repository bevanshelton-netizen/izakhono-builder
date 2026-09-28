# IZAKHONO VIDEO RUNTIME

Owner-hosted image-to-video quality runtime for IZAKHONO SHORTS.

The first backend is a local Wan2.1 I2V Diffusers model. It accepts the existing `izakhono.video.scene.v1` adapter contract, animates the scene keyframe on NODE01 and returns an owner-hosted MP4 URL.

## Production rules

- no telemetry or advertising identifiers;
- no external provider required;
- Hugging Face / Transformers offline mode in the service;
- model weights are not silently downloaded;
- an exact model revision must be staged separately and recorded;
- GPU and local model health must pass before the service reports ready;
- external prompt extension is not used.

The official Wan2.1 project documents local image-to-video inference and Diffusers integration. This runtime uses the same local-I2V architecture but wraps it behind the IZAKHONO capability contract.

## Model staging

After source, licence and hardware review:

```bash
export IZAKHONO_MODEL_DOWNLOAD_APPROVED=true
export IZAKHONO_WAN_REVISION=<exact upstream revision>
sudo -E bash products/izakhono-video-runtime/stage-model-node01.sh
```

The default staged model path is:

`/var/lib/izakhono/models/wan2.1-i2v-480p-diffusers`

## API

`POST /api/v1/generate` with `x-izakhono-video-key`.

Input schema: `izakhono.video.scene.v1`.

The runtime serves completed MP4 assets from `/assets/<id>.mp4`. The Shorts renderer already accepts this response.

## Degraded-mode behavior

If the generative-video runtime is not ready, IZAKHONO SHORTS continues to use its owner-local FFmpeg cinematic-motion fallback. Quality enhancement therefore cannot take the production pipeline down.
