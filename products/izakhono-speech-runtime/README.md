# IZAKHONO SPEECH RUNTIME

Owner-hosted natural text-to-speech service for IZAKHONO SHORTS and the wider SUPER AI capability layer.

The first backend is Kokoro-82M through the upstream `kokoro` inference library. The runtime forces Hugging Face / Transformers offline mode in production: model weights must already be staged in the owner-controlled cache, so normal generation cannot silently download a model.

## API

`POST /api/v1/generate` with header `x-izakhono-speech-key`.

Input schema: `izakhono.speech.generate.v1`.

The response returns an in-memory WAV data URL that the Shorts renderer already understands.

## Privacy and identity

- owner-hosted;
- no telemetry or advertising identifiers;
- no raw-text persistence;
- no voice cloning;
- explicit synthetic voice allowlist;
- offline model loading in service mode.

## Model staging

The installer installs the inference software but **does not download model weights**. Model staging is a separate, auditable step:

```bash
export IZAKHONO_MODEL_DOWNLOAD_APPROVED=true
export IZAKHONO_KOKORO_REVISION=<exact upstream revision>
sudo -E bash products/izakhono-speech-runtime/stage-model-node01.sh
```

The staging step records a model manifest. Commercial activation still requires the exact model/revision/licence to be owner-approved.

## NODE01 readiness

`GET http://127.0.0.1:9731/healthz` returns 200 only when the runtime key, required Python packages and a local model snapshot are present.

This service is a quality adapter. If it is not ready, the Shorts renderer retains the deterministic local espeak fallback rather than calling an external TTS provider.
