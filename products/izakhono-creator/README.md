# IZAKHONO CREATOR

Conversational creative-production engine for IZAKHONO.

## Purpose

Turn a natural-language creative brief into an executable production plan, then route approved production jobs to replaceable media providers. The first vertical is music and short-form video, with the architecture designed to expand into film, advertising, education and business media.

## Core principle

**One conversation -> one production plan -> orchestrated skills -> provider jobs -> reviewable outputs.**

IZAKHONO CREATOR is not tied to a single AI vendor. Model providers are adapters behind the orchestration layer. The current adapter layer supports Runway, Kling and Luma when their server-side credentials are configured. Current provider APIs expose asynchronous video/image generation jobs, so Creator records provider task IDs rather than pretending that submission equals completion.

## MVP capabilities

- Conversational creative brief intake
- Deterministic project planner fallback (no external AI required)
- Skill registry and skill routing
- Music-video production plan
- Short-form social cut plan
- Character/visual consistency requirements
- African-language localization planning
- Provider-neutral generation manifest
- Runway, Kling and Luma adapter contracts
- Explicit generation approval gate
- Server-side provider credentials only
- Truthful status: submitted is not completed and completed is not published

## Initial skills

- `director` — converts the brief into scenes, tone, pacing and production constraints
- `music-video` — maps a song into a music-video treatment and shot list
- `social-pack` — creates a short-form derivative plan for TikTok, Reels and Shorts
- `african-localization` — plans language, cultural and market adaptations without stereotyping

## Generation API

`POST /api/generate` accepts an explicitly approved batch of generation requests. Generation remains disabled until `CREATOR_GENERATION_ENABLED=true` is configured. If `CREATOR_GENERATION_SECRET` is configured, callers must also provide `x-creator-generation-secret`.

Provider keys are server-side Worker secrets:

- `RUNWAY_API_KEY`
- `KLING_API_KEY`
- `LUMA_API_KEY`

Optional routing controls:

- `CREATOR_PROVIDER=runway|kling|luma`
- `CREATOR_GENERATION_ENABLED=true|false`

No keys are committed to the repository.

## Truthfulness / safety

The prototype never reports that a video has been generated, published or made live unless a provider adapter returns evidence. Paid generation, external publishing and irreversible actions remain approval-gated. Provider selection is replaceable so IZAKHONO does not become dependent on one vendor.

## Run

From the repository root:

```bash
npx wrangler dev --config products/izakhono-creator/wrangler.jsonc
```

The planner works without an AI provider. Provider generation requires the corresponding server-side credentials and explicit enablement.


## CINEMATIC AI — ultimate production architecture

The cinematic production programme extends Creator into a complete production operating system. Its canonical, provider-neutral project graph is implemented in:

- `src/cinematic-production-graph.ts` — projects, character/location/prop bibles, scenes, shots, references, assets, tasks and approvals
- `src/cinematic-production-graph.test.ts` — graph integrity, task readiness, evidence-gated completion and dependency-cycle tests
- `CINEMATIC-AI-BLUEPRINT.md` — full product, architecture, commercial and phased delivery specification

Specialist skills are registered for cinematic film direction, character continuity, commercial advertising and virtual production, alongside the existing music-video, social-pack and African-localization skills.

### Production graph rules

The Creator CI workflow typechecks the cinematic graph and brief compiler and runs their deterministic contract tests on pull requests.

- Canonical project facts are separate from generated takes. A failed generation never rewrites the character or scene bible.
- Shots and tasks use explicit dependencies. Cycles and broken references are validation errors.
- A task cannot become completed without evidence; a submitted task must identify its provider.
- Creative, generation, master and distribution approvals are explicit gates.
- Projects are private by default. Planning or generation does not publish a project.
- Assets carry provenance, parent relationships, content hashes and rights/consent metadata.
- The graph is a domain contract; persistence, provider execution and user interface adapters must preserve it.

### Current delivery boundary

The graph contract and deterministic tests are committed on the cinematic foundation branch. This is not a claim that every production provider, GPU worker, 3D editor, audio model, timeline UI or proprietary foundation model is already operational. Those capabilities are delivered and verified in separate phases.


## CINEMATIC API integration

The cinematic production graph now persists inside the existing Creator project store. It does not create a second project, asset or render database.

All routes below require the server-side `CREATOR_GENERATION_SECRET` via the `x-creator-generation-secret` header and an available Creator D1 binding. The secret must never be exposed in browser code.

- `POST /api/cinematic/projects` — compile a brief, validate the graph and save it as a Creator project. Required body: `brief`, `ownerId`; optional: `id`, `title`, `format`, `audience`, `language`, `locale`, `targetRuntimeSeconds`, `aspectRatio`.
- `GET /api/cinematic/projects` — list cinematic projects from the canonical Creator store.
- `GET /api/cinematic/projects/:id` — retrieve the production graph, assumptions, next actions, runnable tasks and validation result.
- `PATCH /api/cinematic/projects/:id` — save an edited graph after validation. Project ID and owner ID are immutable.
- `POST /api/cinematic/projects/:id/approvals/:gate` — decide one pending creative, generation, master or distribution approval.
- `PATCH /api/cinematic/projects/:id/tasks/:taskId` — advance a task with evidence required for completion and provider identity required for submission.

The generation endpoint checks the generation approval gate for projects that contain a cinematic graph. Legacy Creator projects retain their existing workflow. A graph submission is not a completed generation: provider evidence, asset selection and render-worker evidence remain separate state transitions.

### Security and deployment boundary

Configure `CREATOR_GENERATION_SECRET` as a Worker secret before enabling the cinematic API. Do not put it in `studio.ts`, browser JavaScript, a public environment variable or source control. The existing Creator app's project APIs are legacy endpoints and should be placed behind the approved FORTRESS/identity gateway before multi-tenant production use. The cinematic API deliberately fails closed if the server secret or D1 storage is absent. CI now covers its fail-closed security boundary alongside graph, compiler and existing Creator workflow tests.


### Owned Media Runtime Fabric integration

The Creator Worker can submit compiled per-shot video-generation tasks to the existing owner-hosted Media Runtime Fabric. It does not create a second queue.

Configure these Worker secrets/variables server-side:

- `MEDIA_FABRIC_URL` — private-network or approved HTTPS base URL of the fabric broker
- `MEDIA_FABRIC_KEY` — broker's internal key; never expose it to the browser

Additional routes:

- `POST /api/cinematic/projects/:id/tasks/:taskId/submit` — requires the generation approval gate and a base64 PNG/JPEG/WebP `sourceImage` keyframe; submits vertical 9:16 image-to-video work to the owned queue.
- `GET /api/cinematic/projects/:id/tasks/:taskId/status` — polls the broker with the stored opaque job token and advances the task only from broker evidence.

The broker schema supports `image`, `video`, `speech` and `transcription`. The currently registered native worker advertises `video` and `speech`; video execution requires a supplied keyframe and 9:16 vertical aspect ratio. Cinematic image-generation tasks now route through the existing provider-neutral Creator adapter, with Luma as the separately configured image provider (`CREATOR_IMAGE_PROVIDER=luma`, server-side `LUMA_API_KEY`). Image submission requires the generation gate and `CREATOR_GENERATION_ENABLED=true`. Completed image outputs are downloaded only from explicitly allowlisted HTTPS hosts (`CREATOR_IMAGE_ASSET_HOSTS`, comma-separated hostnames), validated as PNG/JPEG/WebP and limited to 16 MB, SHA-256 hashed, and ingested into the existing Creator R2 asset store. The video submit route accepts either the legacy base64 PNG/JPEG/WebP `sourceImage` or a same-project completed image `sourceAssetId`; the latter is resolved from R2 and passed to the owned video worker as a data URI. Configure `CREATOR_IMAGE_ASSET_HOSTS` only with actual approved provider asset hostnames after verifying the provider's output URLs. Speech-worker routing is the next integration step; transcription and 3D remain gated. A broker-reported completion without artifact evidence is not marked complete. The polling token is stored only in the private Creator project record and is never returned by the API.


## FORTRESS-authenticated Cinematic Studio

The primary studio UI is served at `/` and `/cinematic`. Browser API access is routed through `fortress-cinematic-gateway.ts`; the browser never receives `CREATOR_GENERATION_SECRET` or the Media Fabric key.

The gateway verifies an HS256 FORTRESS access token, applies the shared FORTRESS role/tenant permission functions, derives owner and tenant identity from signed claims, and enforces CSRF protection for cookie-authenticated mutations. New production graphs carry the verified tenant ID. Project list/read/write/approval/generation operations are tenant-scoped.

Configure the Creator Worker secrets/variables described in `FORTRESS-SESSION-CONTRACT.md`. The FORTRESS issuer must set the secure `__Host-izakhono_session` and `__Host-izakhono_csrf` cookies. The current in-memory IZAKHONO Identity prototype is not a production login issuer; the Creator UI deliberately reports sign-in unavailable until the central FORTRESS login/session service is deployed and verified.

The legacy project, asset, render and generation APIs now fail closed unless a server-side Creator service credential is configured and supplied by a trusted service. The new browser UI uses only the FORTRESS-gated `/api/cinematic/*` routes. The sign-in panel now calls the same-origin FORTRESS login route, refreshes an expired access session using the rotating refresh cookie, and supports CSRF-protected logout. Every authenticated Creator request requires the `FORTRESS_IDENTITY` service binding and a live D1 session check; no offline JWT fallback is permitted.

The Creator Check workflow also executes the FORTRESS Creator role-permission regression suite.

The FORTRESS access-control test file is maintained with the shared FORTRESS security module and executed by Creator CI.


## Reusable media QA and Facebook delivery profiles

Media delivery is profile-driven, not hard-coded to a single film. The reusable contract in `src/media-export-profile.ts` provides:

- A versioned Facebook Reels profile: MP4, H.264, 1080×1920 (9:16), 30 fps, yuv420p, AAC stereo, 48 kHz and MP4 fast-start.
- An FFmpeg argument builder that returns an argv array (not a shell command string), scales/pads to the target frame and writes the fast-start MP4.
- An ffprobe-based QA report for container, duration, video codec, dimensions, pixel format, frame rate, audio presence, AAC codec, sample rate and stereo channels.
- Explicit manual review gates for playback integrity, dialogue/music rights and sync, captions and safe areas, continuity, credits, fast-start placement and approval before publication.

Run the deterministic contract test from the repository root:

```bash
npm run creator:media-export:test
```

The probe validator must be run against the actual rendered file's ffprobe JSON before a delivery can pass. A passing synthetic contract test is only a software test; it is not proof that a film file exists or passed media QA. The FFmpeg export profile does not create source footage, generate dialogue/music, or bypass generation, master or distribution approvals. External publication remains a separate authorised action.


### Hash-bound distribution QA evidence

The canonical production graph exposes `recordMediaQaEvidence(project, assetId, evidence)` to attach a media worker's machine-QA result to the exact video distribution-export asset. It requires the asset's current SHA-256, the Facebook Reels profile, a worker identity and timestamp, and every required profile check exactly once. Failed QA is retained for audit but cannot unlock distribution. The helper returns a new graph with an incremented version; callers remain responsible for authorised persistence. It does not write to production storage, publish media, or approve distribution.

The authenticated API also exposes `POST /api/cinematic/projects/:projectId/assets/:assetId/media-qa` with `{ "evidence": MediaQaEvidence }`. It persists the immutable graph update through the existing D1 project store. Generic project `PATCH` cannot add, alter or remove media QA records, so evidence must use this dedicated route. Passing evidence is accepted only for completed stored exports; failed evidence may be retained against a failed export record for audit, without storing or promoting the failed media. The route is protected by the existing `x-creator-generation-secret` server-side credential and is not enabled for public access.


### Executable Node media worker and canonical persistence

The container-side adapter in `src/media-export-node-runtime.ts` implements the media executor's process and filesystem contract using Node child processes (without a shell), bounded stdout/stderr, a configurable execution timeout and SHA-256 hashing. It is intentionally not imported into the Cloudflare request-worker entry point.

A worker with an approved master, an auditable master approval and a runnable export task calls `executeProductionDistributionExport` from `src/cinematic-media-export-worker.ts`. The worker resolves the approved master object to a local file, verifies its SHA-256 before invoking FFmpeg, runs ffprobe and MP4 fast-start checks, stores bytes only when all machine checks pass, and creates an evidence-linked distribution asset and export-task result. Failed QA is retained in the graph but never stored as a deliverable.

The worker then calls `persistProductionExportResult` with the Creator API base URL and its server-side service credential. This bridge first reads the latest canonical graph, applies only the export asset/task delta through the graph PATCH route without including QA evidence, then posts the exact hash-bound QA evidence to the dedicated media-QA endpoint. If the QA POST temporarily fails, the export asset remains visible but delivery readiness stays blocked; a retry reads the current graph and completes only the missing evidence step. Replaying an already-recorded identical result is a read-only no-op. Conflicting asset IDs or hashes are rejected.

The worker's object-store adapter and Creator API credential are injected by the operator at runtime. No storage credentials, service secrets, provider keys, paid generation, public publishing or production deployment are bundled into this code or enabled by these tests. Run `npm run creator:media-export:test` to exercise the profile, executor, Node runtime and graph-to-FFmpeg-to-API persistence contracts using deterministic fixtures; those tests do not create a real film or certify an actual export.


### Human review and distribution approval gate

A machine-QA-passed export is not automatically approved for distribution. The append-only `humanReviews` history on a distribution asset records a named reviewer, timestamp, review ID, Facebook profile and the exact export SHA-256. The required checks cover full-file playback integrity, dialogue/music/effects clarity and sync, captions and mobile safe areas, continuity/titles/credits, and playback after a private staging upload. Each check carries a reviewer finding.

The authenticated endpoint `POST /api/cinematic/projects/:projectId/assets/:assetId/human-review` records this evidence. Generic graph PATCH cannot create, alter or remove human review history. Distribution approval is rejected unless the project has a completed stored distribution export with matching passing machine QA and a passing latest human review bound to the same bytes. A failed later review blocks distribution again; a subsequent passing review is appended rather than overwriting history.


### Original source-media ingestion

The authenticated cinematic API accepts original source footage, audio and reference images at:

`POST /api/cinematic/projects/:projectId/source-media`

Send the raw binary request body with:
- `content-type`: supported image, video or audio MIME type
- `content-length`: required, 1 byte to 100 MB
- `x-creator-filename`: original filename (stored as provenance metadata, never used as a storage path)
- `x-creator-uploader-id`: authenticated operator identity
- `x-creator-licence`: explicit licence/rights declaration
- `x-creator-consent-status`: `provided`, `not_applicable` or `unverified`
- `x-creator-consent-record-ids`: required comma-separated record IDs when consent status is `provided`
- `x-creator-shot-id`: optional existing shot ID to associate the original with a shot

The route computes SHA-256 server-side, stores the original in the private Creator R2 binding under a server-generated project-scoped key, and appends a source asset plus hash-bound intake evidence to the canonical production graph. A supplied licence remains a declaration, not a legal verification: source assets remain rights-review-unverified and are not treated as rights-cleared by the production manifest. The uploader ID is a caller-supplied identity assertion; this service-secret endpoint does not independently authenticate an individual human identity. It does not return a public media URL. Source evidence is immutable through the general graph PATCH route. Missing or unverified consent is recorded as such; the system does not infer permission from an upload. The endpoint requires the existing server-side Creator secret and D1 plus private R2 storage.

The request limit is currently 100 MB and content type is checked against an explicit allowlist. A failed graph save after object upload can leave a private orphan object; the API reports the failure and requires operator reconciliation before retry. No production bucket or source files are configured by this code change.

### Source-media rights review

A source upload is never rights-cleared by its filename, uploader declaration, licence text or consent status alone. The authenticated endpoint `POST /api/cinematic/projects/:projectId/assets/:assetId/rights-review` appends a decision with:
- a unique review ID and reviewer identity;
- `verified` or `rejected` decision;
- the exact source asset SHA-256;
- a written decision basis and one or more evidence-reference IDs;
- reviewer timestamp.

The latest decision controls rights readiness. A later rejection blocks an earlier verification; a changed source hash invalidates the earlier decision. The original source-intake evidence remains immutable, and general graph PATCH cannot add, change or remove rights-review history. The reviewer ID is currently an identity assertion supplied in the evidence behind the server-side service credential; it is not yet independently verified against a FORTRESS human session or a rights-document registry. Review evidence references are audit references, not proof that an external document was independently validated. A verified decision therefore records the authorised reviewer's determination; it is not a legal opinion generated by Creator. Original source image assets are eligible as video-generation keyframes only after the latest rights decision is `verified`; immediately before use, Creator re-reads the private object and recomputes SHA-256, rejecting missing or changed bytes. This gate applies to graph-ingested original source assets; previously supported Creator-generated image assets retain their existing project-asset path.

