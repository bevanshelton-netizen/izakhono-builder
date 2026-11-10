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
