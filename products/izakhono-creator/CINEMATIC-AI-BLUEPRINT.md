# IZAKHONO CINEMATIC AI — Product and Engineering Blueprint

**Status:** Foundation specification  
**Product family:** IZAKHONO CREATOR  
**Working product name:** IZAKHONO CINEMATIC AI  
**Principle:** OWNED-FIRST. PROVIDER-NEUTRAL. FLAT-RATE CUSTOMER ACCESS. EVIDENCE-GATED OUTPUTS.

## 1. Product ambition

Build an original, integrated AI production environment that takes a creative brief through concept development, script, storyboard, shot design, asset generation, editing, sound, mastering and distribution. It must be materially more capable than a collection of disconnected image/video generators.

This is not a UI clone of Higgsfield. Do not copy proprietary designs, assets, prompts, source code, model weights or brand elements. Compete through production intelligence, continuity, orchestration, creative controls, African creative intelligence, owned infrastructure and a superior end-to-end workflow.

## 2. Product promise

A user describes the production they want. The system:
1. Understands the brief and asks only for missing production-critical information.
2. Creates a structured project, creative treatment, script and production plan.
3. Builds a storyboard and shot list with editable direction.
4. Establishes project bibles for characters, wardrobe, props, locations, lighting, colour and sound.
5. Selects the best available generation or editing capability for each task.
6. Runs approved jobs through durable queues and replaceable providers or owned workers.
7. Tracks every job truthfully from queued to submitted, processing, completed or failed.
8. Stores generated assets with provenance, hashes, rights/consent metadata and project relationships.
9. Assembles, edits, versions and exports the final production and its derivatives.
10. Prepares distribution packages without publishing externally until the user authorises it.

## 3. Product divisions

### A. Director Intelligence
- Brief analysis and creative intent extraction
- Concept, treatment, synopsis, script and dialogue
- Genre, tone, pacing and audience controls
- Scene breakdown, shot list, coverage plan and production schedule
- Continuity bible and revision-aware planning
- Budget/time/quality trade-off recommendations

### B. Cinema Studio
- Shot-by-shot production workspace
- Virtual camera controls: shot size, lens intent, focal length, camera movement, angle, focus, depth of field and framing
- Lighting direction, time of day, atmosphere, colour palette and exposure intent
- First/last frame and reference-guided shot generation where providers support it
- Multi-shot sequencing and scene-level review
- Timeline, takes, versions and approvals

### C. Image Studio
- Text/image/reference-to-image workflows
- Inpainting, outpainting, masking, object replacement and background replacement
- Product, fashion, editorial, campaign, concept-art and environment workflows
- Reference sets and controlled variation
- Image inspection and quality gates

### D. Video Studio
- Text/image/video-to-video generation where supported
- Scene extension, shot continuation and controlled transitions
- Video restyling and object/background editing
- Motion references and camera-motion controls where supported
- Frame interpolation, stabilisation, deflicker, upscaling and reframing
- Clear disclosure of provider-specific limitations

### E. Character and Performance Studio
- User-owned or properly licensed character references
- Character identity sheets and reusable character profiles
- Wardrobe, hair, age-range, body/face consistency constraints
- Voice and performance profiles with consent records
- Scene-to-scene identity checks
- No unauthorised impersonation or non-consensual voice/likeness cloning

### F. Motion and 3D World Studio
- Motion-reference ingestion and animation planning
- Environment, set, prop and object libraries
- 3D scene assembly and camera blocking
- Rigging/animation adapters where available
- Asset-level provenance and licence records
- Progressive rendering for low-powered devices

### G. Advertising and Campaign Studio
- Product and brand intake
- Campaign concept and creative strategy
- Product-preserving image/video workflows
- UGC-style, demonstration, unboxing, brand film and broadcast-ad formats
- Multiple aspect ratios, hooks, CTAs, languages and campaign variations
- Brand kit, logo and typography protection checks

### H. Sound Studio
- Script-to-voice and approved voice workflows
- Dialogue, ambience, sound effects and music
- Audio-to-video synchronisation and lip-sync adapters
- Dubbing, subtitles, captions and translation
- Loudness, clipping and mix checks
- Commercial-use and music-rights records

### I. Post-production Studio
- Non-destructive timeline editing
- Prompt-assisted editing with inspectable changes
- Compositing, masking, colour grading and transitions
- Captioning, titles, credits and end cards
- Audio mixing and mastering
- FFmpeg/render-worker assembly, previews and final export

### J. Distribution Studio
- Platform-specific export presets and safe-area checks
- Master plus vertical, square, portrait and landscape derivatives
- Thumbnail, caption, subtitle and metadata packages
- Approval-gated social publishing connectors
- Campaign calendar and asset performance integration

## 4. The defensible advantage: Production Intelligence

The platform's core asset is not the number of model buttons. It is the production graph and memory that coordinate them.

Each project has a typed production graph:
- Project
- Brief and creative constraints
- Script and revisions
- Scenes
- Shots and shot dependencies
- Character, wardrobe, prop and location bibles
- Reference assets
- Generation/edit jobs
- Takes and selected shots
- Timeline and audio tracks
- Master exports and derivatives
- Approvals, rights and provenance

The director agent plans work against this graph. The continuity service checks new outputs against approved project facts. The orchestrator selects providers by capability, quality target, latency, availability, rights constraints and measured cost. A user can replace a take without rebuilding the entire project.

## 5. Architecture

### Experience layer
- IZAKHONO CREATOR Studio as the unified application
- Responsive browser workspace and installable PWA
- Role-aware workspaces for solo creators, teams, agencies and enterprise
- Accessible controls, keyboard navigation and reduced-motion support

### Intelligence layer
- Director agent and specialist production skills
- Structured schemas for briefs, scenes, shots, assets and jobs
- Project memory and continuity checks
- Prompt compiler and provider-specific prompt adapters
- Quality evaluator and human review gates

### Orchestration layer
- Capability registry and provider-neutral model router
- Cost/latency/quality policy engine
- Durable job queue, leases, retries and cancellation
- Idempotent job submission and callback/polling adapters
- Explicit job status and evidence records
- Concurrency and resource-aware scheduling

### Media execution layer
- Existing IZAKHONO MEDIA RUNTIME FABRIC for durable job control
- Existing owned image runtime and ComfyUI adapter
- Existing owned video runtime and FFmpeg render worker
- GPU/CPU worker pools with capability and hardware reporting
- External providers as optional, replaceable adapters
- No external provider as the sole source of truth

### Data and storage layer
- Existing project-store and asset metadata contracts, consolidated rather than duplicated
- Object storage with private-by-default access
- Content hashes, immutable source references and versioned outputs
- Project, asset, job, approval and rights metadata
- Replication and backup/restore evidence before HA claims

### Security and governance
- FORTRESS identity, tenant isolation and access policy integration
- Server-side provider credentials only
- Signed, short-lived asset access
- Encryption in transit and at rest
- Consent and rights metadata for likeness, voice, music and reference assets
- Abuse controls, audit logs and moderation
- External publishing, paid generation and destructive changes remain approval-gated

## 6. Provider-neutral capability contract

Provider adapters must declare:
- Supported media kinds and task types
- Input modalities and reference limits
- Output dimensions, durations, formats and frame-rate limits
- Native audio and dialogue support
- First/last-frame and video-reference support
- Editing, extension, masking and motion-control support
- Queue/poll/callback semantics
- Retention, privacy, region and commercial-use terms
- Measured latency, reliability and cost where known

The router must never imply that a provider supports a feature it does not expose. Capability selection must be deterministic and explainable. Provider keys remain server-side. Do not hardwire one vendor into product logic.

## 7. Existing foundation to reuse

The repository already contains:
- `products/izakhono-creator`: conversational creative planner, skills, provider router, production compiler, render engine, master factory and project store
- Existing director, music-video, social-pack and African-localization skills
- Runway, Kling and Luma adapter contracts
- `products/izakhono-media-fabric`: durable encrypted queue, worker leases, retries, capability-aware scheduling and artifact integrity
- `products/izakhono-media-runtime`: owner-hosted image generation path
- `products/izakhono-video-runtime`: owner-hosted image-to-video runtime contract
- `products/izakhono-media-core`: owned media control-plane foundation
- `apps/izakhono-creator-studio` and `public/ai-core/studio`: existing user-interface starting points
- `izakhono-model-router` and `izakhono-creator-studio` Vercel projects connected to the same repository

Consolidate and extend these assets. Do not create another parallel creative product or duplicate job, asset, project or provider registries without a documented migration reason.

## 8. Delivery sequence

### Phase 0 — Foundation audit and product contract
- Inventory current Creator, Studio, router, media fabric, image/video runtime and data contracts
- Map each capability to implemented, partial, planned or unavailable
- Identify duplicate registries, schemas and APIs
- Establish shared project, asset, job, provider and rights contracts
- Define end-to-end acceptance tests and evidence requirements

### Phase 1 — Creator Studio unified command centre
- Unified navigation and project workspace
- Conversational brief intake
- Director plan, script, scenes and editable storyboard
- Project bible and continuity metadata
- Asset library and job activity
- Generation approval and truthful status display
- Existing adapters wired through the router

### Phase 2 — Production-grade generation and assembly
- Durable job execution through Media Runtime Fabric
- Owned image/video workers and provider adapters
- Shot-level retry and replacement
- Timeline assembly, audio tracks and derivatives
- Asset vault, versions, provenance and export

### Phase 3 — Advanced cinema and campaign tools
- Camera/lens/light controls
- First/last frame, motion and reference controls
- Character identity and wardrobe continuity
- Prompt-assisted video editing and post-production
- Product-preserving advertising workflows

### Phase 4 — 3D, sound and collaborative production
- 3D environments and reusable virtual sets
- Motion capture/animation adapters
- Dialogue, dubbing, sound effects and music
- Team workspaces, comments, approvals and reusable templates

### Phase 5 — Proprietary model programme
- Evaluate owned open-weight image/video/audio models against quality, licence, hardware and operating cost
- Stage models only after explicit owner approval and hardware validation
- Build fine-tuning, evaluation and dataset-governance pipelines only with rights-cleared data
- Gradually replace expensive or strategically critical external tasks
- Keep provider adapters available as resilience and quality fallbacks

## 9. Commercial model

- Customer-facing flat-rate subscriptions and enterprise agreements
- No artificial per-prompt, per-build or proprietary credit wallet
- Internal capacity governance and fair-use safeguards are permitted
- Expensive external provider calls must be routed through cost-aware policies and plan entitlements
- Do not promise unlimited third-party generation where upstream vendors meter usage
- Offer transparent production limits/queues and upgrade paths without disguising upstream costs
- Keep customer pricing predictable while optimising owned compute and model serving

## 10. Non-negotiable engineering rules

1. Owned-first; externally reversible.
2. Reuse existing IZAKHONO infrastructure before creating another service.
3. Keep provider-specific code behind adapters.
4. Never store secrets in source control or expose them to browsers.
5. Never equate submitted with completed, completed with approved, or approved with published.
6. Never claim production readiness without runtime, security, backup, performance and end-to-end evidence.
7. Do not silently download model weights or accept model licences; owner approval is required.
8. Do not promise exact identity, text rendering, lip-sync or physics fidelity where the selected model cannot guarantee it.
9. Protect user likeness, voice, copyright, privacy and commercial rights.
10. Preserve originals and make editing/versioning non-destructive.

## 11. Phase 1 acceptance criteria

The first public-capable release is not accepted until:
- A user can create a project from a natural-language brief.
- The director creates editable scenes and shots with a project bible.
- The user can edit and approve a bounded generation plan.
- The router selects only a provider whose declared capabilities match the request.
- Jobs are durable, retryable, cancellable and correctly associated with the project.
- The UI distinguishes queued, submitted, processing, completed, failed and cancelled states.
- Completed assets are stored privately with hashes and provenance.
- The user can select takes, assemble a timeline and export a master plus social derivatives.
- Missing credentials or unavailable workers produce honest actionable errors.
- Tenant isolation, authorisation, secret handling and asset access pass security tests.
- Runtime evidence confirms the actual workers and storage used by the deployment.
- No customer is charged or external publication triggered without the required entitlement and approval.

## 12. Immediate engineering priorities

1. Audit the full existing Creator Studio UI/API and all current project/asset/job schemas.
2. Audit model-router provider coverage against current provider APIs and terms.
3. Connect Creator generation jobs to Media Runtime Fabric using a single canonical job contract.
4. Complete project bible, scene/shot graph and continuity validation.
5. Implement take selection, asset vault and non-destructive timeline assembly.
6. Make the unified Studio the customer-facing entry point; keep router and workers as internal services.
7. Test on preview first; production deployment and public-live claims require evidence.

**North-star outcome:** One creative brief becomes a complete, editable, reviewable and exportable production — with IZAKHONO controlling the workflow, the data, the production graph and the infrastructure.
