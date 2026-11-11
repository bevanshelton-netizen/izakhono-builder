# IZAKHONO ASR Runtime

Owner-hosted speech-to-text service for IZAKHONO VOICE. It uses faster-whisper locally; inference does not require a third-party speech API.

## API

- `GET /healthz` — readiness; returns 503 until the local model is staged.
- `POST /api/v1/transcribe` — requires `x-izakhono-speech-key`.

Request:
```json
{"schema":"izakhono.speech.transcribe.v1","audio_base64":"<base64 mono PCM16 WAV>","language":"en"}
```

The service accepts short mono PCM16 WAV clips and returns transcript text and detected language. It supports English, Afrikaans and selected South African languages, subject to model quality. Never assume every language or accent has production-grade accuracy without a recorded evaluation set.

## Install and model staging

Run `sudo bash install-node01.sh`. This installs the service but does not fetch model weights. Model weights must be approved and staged separately:

```bash
export IZAKHONO_ASR_MODEL_DOWNLOAD_APPROVED=true
export IZAKHONO_ASR_MODEL_REVISION=<exact-approved-model-revision>
sudo -E bash products/izakhono-asr-runtime/stage-model-node01.sh
```

Review model licence and commercial terms before staging or customer use. Inference uses CPU int8 by default; hardware acceleration can be added after owner-node benchmarking.

## Security

- Binds to loopback only.
- Internal random key stored in `/etc/izakhono/apps/izakhono-asr-runtime.env`.
- No audio or transcript persistence; clips use temporary files and are removed when requests finish.
- Single inference lock prevents unbounded simultaneous model execution.
- Runtime does not silently download models.

## Status

Code and deployment scripts only. No model is staged and no owner node installation or live call test is claimed.
