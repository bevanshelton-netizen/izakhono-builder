# IZAKHONO SHORTS FACTORY

Owned-first short-form video production engine for IZAKHONO CREATE.

The app converts one brief into an original 9:16 content plan, character-consistency rules and a render job. It is deliberately provider-neutral: the IZAKHONO control plane owns planning, policy, queueing and job state, while video/image/voice generation is reached through a replaceable renderer contract.

## Current tranche

- responsive Shorts production UI
- one-brief storyboard generation
- 9:16 scene planning for 15–180 second content
- kids-safe mode and `made_for_kids` metadata
- originality review flag for copycat prompts
- durable file-backed job queue
- owned-renderer-first routing
- external fallback disabled by default and reversible when explicitly enabled
- no telemetry, advertising IDs or behavioural tracking
- publishing is **not** automatic; completed media is handed to a separate publisher workflow
- standalone Docker deployment on NODE 01

## Run on NODE 01

```bash
docker build -t izakhono-shorts .
docker run --rm \
  -p 9710:9710 \
  -e IZAKHONO_SHORTS_RENDER_URL=http://host.docker.internal:9721 \
  -e IZAKHONO_SHORTS_RENDER_KEY=change-me \
  -v izakhono-shorts-jobs:/app/data/jobs \
  izakhono-shorts
```

Run a worker against the same jobs volume:

```bash
docker run --rm \
  -e IZAKHONO_SHORTS_RENDER_URL=http://host.docker.internal:9721 \
  -e IZAKHONO_SHORTS_RENDER_KEY=change-me \
  -v izakhono-shorts-jobs:/app/data/jobs \
  izakhono-shorts python worker.py
```

Health: `GET /healthz`


## Real end-to-end launch gate

The root launcher `START-IZAKHONO-SHORTS-NODE01.cmd` does not stop at service health.

After the renderer, API and worker are healthy it runs `e2e.py` in a one-shot container. That gate:

1. requires external fallback to be disabled;
2. queues an original educational Short through the normal API;
3. waits for the normal worker to use the owned renderer;
4. requires the completed job route to be `owned`;
5. HEAD-checks and downloads the generated MP4;
6. validates the MP4 container signature and minimum size;
7. downloads the VTT captions and immutable render manifest;
8. verifies the manifest says owned route, no tracking, no autopublish, MP4, 1080x1920 and 30 fps; and
9. writes an evidence report plus the first generated Short to `Desktop\\IZAKHONO-SHORTS-EVIDENCE`.

The launcher prints operational success only when that evidence report contains `"live_claim_allowed": true`.

## Quality runtime layer

The launcher now attempts two additional owned quality services before starting the core renderer:

- `IZAKHONO Speech Runtime` on port 9731 — local Kokoro-class natural speech when an owner-approved model snapshot is staged.
- `IZAKHONO Video Runtime` on port 9741 — local Wan-compatible image-to-video generation when an owner-approved Diffusers snapshot and suitable NVIDIA GPU are present.

Both services are optional enhancements, not production dependencies. The renderer attaches them only after their independent local health gates return HTTP 200. If either service is unavailable, Shorts continues with the existing local espeak voice and FFmpeg cinematic-motion fallback. An unavailable quality model therefore cannot force an external provider or take the baseline renderer down.

Model weights are never silently downloaded by service startup. Separate staging scripts require an explicit approval flag and exact upstream revision, then record a model manifest.

## Renderer contract

The owned media renderer receives:

`POST /api/v1/render`

```json
{
  "schema": "izakhono.shorts.render.v1",
  "job_id": "shorts_...",
  "plan": {"schema":"izakhono.shorts.plan.v1"},
  "output": {"container":"mp4","width":1080,"height":1920,"fps":30},
  "policy": {
    "owned_first": true,
    "external_fallback_reversible": true,
    "no_tracking": true,
    "originality_required": true
  }
}
```

Expected success response:

```json
{
  "ok": true,
  "asset": {"type":"video/mp4","url":"https://owned-host/.../output.mp4"},
  "captions": {"url":"https://owned-host/.../captions.vtt"}
}
```

The renderer itself can be implemented with IZAKHONO-hosted open-weight image/video/speech models plus FFmpeg. External providers remain optional adapters only.

## Environment

- `IZAKHONO_SHORTS_HOST` default `0.0.0.0`
- `IZAKHONO_SHORTS_PORT` default `9710`
- `IZAKHONO_SHORTS_JOB_DIR` default `./data/jobs`
- `IZAKHONO_SHORTS_RENDER_URL` default `http://127.0.0.1:9721`
- `IZAKHONO_SHORTS_RENDER_KEY` internal renderer credential
- `IZAKHONO_SHORTS_ALLOW_EXTERNAL_FALLBACK` default `false`
- `IZAKHONO_SHORTS_EXTERNAL_URL` optional resilience renderer
- `IZAKHONO_SHORTS_EXTERNAL_KEY` optional resilience credential

## Launch truth

The control plane can be verified independently at `/healthz`. A Short is not described as generated until the worker receives `ok:true` from the configured owned renderer, the resulting media asset is reachable, and the NODE01 end-to-end evidence gate has produced and re-downloaded a valid MP4. Service health alone is not sufficient for an operational claim.
