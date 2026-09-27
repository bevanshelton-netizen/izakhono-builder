# IZAKHONO BUSINESS AI

A privacy-first small-business operating assistant for South African SMEs.

## What is built in v0.3

- Premium responsive landing page and workspace
- Client register stored locally in the user's browser
- Quote and invoice builder with print/PDF export
- Email handoff using the device's configured mail client
- AI correspondence writer with an IZAKHONO-owned/provider-neutral adapter boundary
- Business Growth Diagnostic
- Decision Lab v0.3 with evidence packets, source hashes, evidence graph, 12–100 agents, 3–10 repeated simulations, 2–5 reaction rounds, uncertainty ranges, Scenario A/B comparison, Red-Team agents, Report Agent summaries, report interrogation, local calibration logging and JSON export
- JSON backup/export of local business data
- No third-party analytics, advertising IDs or behavioural profiling
- Independent Cloudflare Worker engine with /api/health

## Architecture

Primary target: IZAKHONO-owned runtime -> EDGE/TLS -> DNS.

External hosting may be used only as a reversible resilience route. The product is packaged as a self-contained Worker application so it can run independently from other IZAKHONO products.

The optional AI adapter is configured with AI_GATEWAY_URL and AI_GATEWAY_TOKEN. If no AI adapter is configured, the application stays useful in local template mode and clearly labels that state. No browser API keys are used.

## FLOW advisory adapter

BUSINESS AI can serve as the current provider-neutral advisory adapter behind the `izakhono-super-ai` FLOW target.

`POST /api/flow` accepts only `advisory.suggestion.requested` when `BUSINESS_AI_FLOW_TOKEN` matches. The adapter requires entity and platform scope headers and returns advice only.

Guardrails are explicit: the adapter cannot move money, confirm payment, make a regulated decision, or silently send a communication. If the AI gateway is unavailable it returns a deterministic next-step suggestion instead of pretending an AI call succeeded.

## Privacy

Business records are local-first in v0.3. The browser stores clients and documents on-device, and the user can export a JSON backup. The app does not load third-party analytics or tracking scripts.

## MiroFish exploration

See docs/MIROFISH-RESEARCH.md. We are not importing MiroFish code into this proprietary product. The initial Decision Lab is an original clean-room implementation of the general idea of multi-perspective scenario rehearsal.

## Run

npm install
npm run dev

## Validate

npm run validate

Do not describe the public product as live until its owned or external route independently returns HTTPS 200 and renders the verified experience.


## Decision Lab v0.2

Decision Lab now accepts a scenario, stakeholders, a time horizon and an optional evidence packet of text, Markdown, CSV or JSON files. The browser reads source files locally and sends them to the BUSINESS AI engine only when the owner runs the rehearsal.

The engine:

- hashes each accepted source with SHA-256;
- derives a reproducible run ID from the simulation inputs;
- extracts high-frequency evidence terms;
- creates a lightweight evidence graph linking the scenario, sources, stakeholders and terms;
- creates one deterministic agent persona for each stakeholder;
- runs 2–5 reaction rounds with group influence;
- reports final stance, risks, evidence gaps, consensus and disagreement;
- exports the complete run as JSON.

This is intentionally a structured rehearsal engine rather than a claim of prediction certainty. Outputs remain hypotheses until checked against real people, real operating data and real market evidence.

### Current source boundary

v0.2 supports text-based files up to the client/server safety limits. PDF extraction is not silently delegated to a third party; a privacy-preserving owned document-extraction adapter is the next planned capability.

### MiroFish boundary

MiroFish remains a research reference only. No MiroFish source code is imported. IZAKHONO Decision Lab is being implemented independently so the proprietary BUSINESS AI product retains its own architecture and licensing boundary.


## Decision Lab v0.3

v0.3 expands the clean-room IZAKHONO simulation engine without importing MiroFish code.

New capabilities:

- 12, 25, 50 or 100-agent synthetic populations;
- 3, 5 or 10 repeated simulation runs;
- cross-run uncertainty ranges and standard deviation;
- Scenario A vs Scenario B comparison using the same evidence and synthetic population rules;
- Red-Team findings for operational failure, fraud/abuse, evidence quality, commercial downside and relevant compliance concerns;
- Report Agent synthesis;
- "Ask the simulated world" structured interrogation of the generated report;
- local-first calibration records so the owner can record what actually happened;
- basic local extraction for simple text-based PDFs, with no silent third-party upload.

### PDF boundary

The browser can extract text from some simple text-based PDFs locally. Complex compressed PDFs and scanned/image-only PDFs are deliberately not uploaded to an external service. They remain blocked until the IZAKHONO-owned document-extraction service is available. This keeps the privacy boundary explicit rather than pretending unreliable extraction succeeded.

### Interpretation

The displayed uncertainty range is variation across the synthetic repeated runs. It is **not** a statistical confidence interval for the real world. Scenario comparison describes differences in the simulation output; it does not choose for the user.


## Owned runtime package

`owned-runtime/` is the primary NODE01 deployment package for BUSINESS AI. It contains a stateless Node.js 22 server, a single-file privacy-first application, Dockerfile, Docker Compose service, public acceptance script and deployment runbook.

The owned runtime intentionally keeps customer business records and Decision Lab calibration data local-first in the browser. Server-side persistence is not invented where it is not needed.

Intended owned hostname: `businessai.izakhono.co.za`.

Current status remains **NOT YET PUBLIC** until the NODE01 → EDGE/TLS → DNS path passes public HTTPS acceptance and backup/restore/rollback evidence is recorded.

### External resilience attempt

The current Supabase free project has reached its Edge Function count limit. Reusing the static publisher successfully produced an HTTPS 200 copy of the app, but Supabase served the HTML route as `text/plain` with a sandbox policy. That route is therefore **not** accepted as a live customer experience and is not used to inflate launch status.
