# IZAKHONO Content Command Centre

AI-powered content production control plane based on the 10-tool workflow shown in the reference Reel.

## Tool adapters

1. Whisper — transcription/subtitles
2. yt-dlp — permitted media ingestion
3. FFmpeg — media processing
4. Remotion — programmatic motion graphics/video
5. Visual AI — replaceable image/video provider adapter
6. YouTube Analytics — performance intelligence
7. Meta/Instagram — social intelligence
8. Community — community publishing adapter
9. Engagement — comment/reply workflows
10. IZAKHONO Agent Core — orchestration, memory and routing

## Owned-first rule

The adapters are replaceable capacity. The IZAKHONO Content Command Centre owns the workflow definition, campaign state, validation rules, output manifests and provider abstraction. No provider is treated as the system foundation.

## Current MVP

- command-driven production-plan interface
- eight-stage content pipeline
- ten adapter registry
- deterministic orchestration API at `/api/orchestrate`
- mobile-responsive liquid-glass-inspired interface

## Production expansion

Next layers are media job execution, object storage, provider credentials, social publishing OAuth, analytics ingestion, rights/brand QA, campaign memory and queue workers. Provider credentials must remain server-side.
