# IZAKHONO SUPER AI — Free/Open-Weight Intake Baseline

This file is an intake list, not a claim that every model is already installed or production-ready. A model becomes an IZAKHONO runtime only after licence review, hardware benchmarking, safety testing, quality testing and owned-route health verification.

## Preferred starting set

### Text / general assistant
- **Qwen3** — preferred owner-hosted general family. Qwen publishes open-weight Qwen3 models under Apache 2.0.
- **DeepSeek-V3 family** — optional secondary reasoning/general family. The code repository is MIT licensed; model use is governed by DeepSeek's model licence and supports commercial use according to the project documentation.

### Coding
- **Qwen3-Coder** — preferred code/agent family where the available node has sufficient memory/compute. Keep smaller local fallbacks for owner devices that cannot run the larger checkpoints.

### Image
- **FLUX.1 schnell** — preferred permissive image baseline; Apache 2.0.
- Do not use FLUX dev variants commercially without the appropriate commercial rights because their published dev licence is non-commercial.

### Video
- **Wan2.1 / compatible Wan open models** — preferred first owner-video baseline; the Wan2.1 project publishes its models under Apache 2.0.

### Speech
- **Kokoro** — preferred lightweight TTS baseline where the selected weights/voice packs carry acceptable commercial terms. Verify each voice pack separately.

### Transcription
- **Whisper-compatible local runtime** — baseline speech-to-text path; the reference Whisper project is MIT licensed.

## IZAKHONO improvement layer

We are not exposing these as a bag of vendor buttons. IZAKHONO adds:

1. one capability API across models;
2. owner-controlled identity and subscription checks;
3. model allowlists and per-capability routing;
4. hardware-aware selection and graceful fallback;
5. no browser API keys;
6. no raw-prompt persistence in the gateway;
7. no behavioural tracking or advertising IDs;
8. portfolio-wide reusable tools and agents;
9. South African and African language/domain optimisation where evaluation proves quality;
10. future IZAKHONO fine-tunes, adapters, retrieval and proprietary workflow intelligence without locking applications to a model brand.

## Source references reviewed for this baseline

- Qwen3: https://github.com/QwenLM/Qwen3
- Qwen3-Coder: https://github.com/QwenLM/Qwen3-Coder
- DeepSeek-V3: https://github.com/deepseek-ai/DeepSeek-V3
- FLUX: https://github.com/black-forest-labs/flux
- Wan2.1: https://github.com/Wan-Video/Wan2.1
- Whisper: https://github.com/openai/whisper

## Commercial rule

"Free/open-weight" does **not** mean zero operating cost. GPU/CPU compute, electricity, storage, bandwidth, backups and operations still cost money. It also does not override a model's licence. Production activation must record the exact model version, source, licence, checksum and approved use.
