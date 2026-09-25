# IZAKHONO Media Runtime

Owner-controlled image-generation runtime for **IZAKHONO CREATE — One Click Campaign**.

## Runtime path

```text
IZAKHONO CREATE
  -> media-gateway.py (Free/Pro policy + entitlement)
  -> 127.0.0.1:9696 IZAKHONO Media Runtime
  -> 127.0.0.1:8188 local ComfyUI
  -> owner-host GPU + owner-selected checkpoint
```

The browser never talks directly to ComfyUI and never receives the renderer secret.

## Supported modes

- `starter_campaign`
- `campaign`
- `showcase`
- `lifestyleshot`
- `metaads`
- `modelshot`
- `catalogue`
- `3dbillboard`
- `360view`

The current renderer uses an img2img workflow. Product/background/model/angle outputs are generative approximations. Logos, text, cuts, patterns, rear views and hidden geometry must be checked before publication. A future product-preservation pipeline can add segmentation/compositing and dedicated virtual-try-on models behind the same API.

## Security

- Media Runtime binds to loopback by default.
- `POST /api/v1/generate` requires `x-izakhono-media-key`.
- The secret is machine-local under `/etc/izakhono/apps/izakhono-create-media.env`.
- ComfyUI is also loopback-only.
- Public traffic must pass through the reviewed CREATE gateway / EDGE path.
- No outside image vendor is hard-coded into this runtime.

## NODE01 activation

From the repository root on the Windows owner host:

`START-IZAKHONO-CREATE-MEDIA.cmd`

The launcher runs the installer inside Ubuntu/WSL and writes:

`Desktop\IZAKHONO-CREATE-MEDIA-REPORT.json`

The installer can install a local ComfyUI copy when it is absent. It does **not** silently download a model checkpoint or claim the GPU is suitable. The checkpoint remains an owner-controlled selection. The NODE01 evidence report only marks the stack ready when the runtime and gateway are healthy **and** an NVIDIA GPU is visible; CPU-only operation requires the owner to explicitly set `IZAKHONO_MEDIA_ALLOW_CPU=true` for a slow test.

### Checkpoint

Set `IZAKHONO_MEDIA_CHECKPOINT` in:

`/etc/izakhono/apps/izakhono-create-media.env`

to the exact filename already present under:

`/opt/izakhono-comfyui/models/checkpoints/`

If a checkpoint already exists and no name is configured, the installer selects the first local checkpoint deterministically.

## Readiness

`GET http://127.0.0.1:9696/healthz`

returns HTTP 200 only when:

1. the internal runtime key exists;
2. local ComfyUI is reachable; and
3. the configured checkpoint is visible to ComfyUI.

The one-click NODE01 evidence gate is stricter: it also requires visible GPU compute unless CPU-only testing was explicitly enabled.

Software CI cannot prove GPU availability, model download/licence acceptance, model quality, generation latency, public TLS, or the physical NODE01 runtime.
