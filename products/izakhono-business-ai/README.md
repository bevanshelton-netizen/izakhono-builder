# IZAKHONO BUSINESS AI

A privacy-first small-business operating assistant for South African SMEs.

## What is built in v0.2

- Premium responsive landing page and workspace
- Client register stored locally in the user's browser
- Quote and invoice builder with print/PDF export
- Email handoff using the device's configured mail client
- AI correspondence writer with an IZAKHONO-owned/provider-neutral adapter boundary
- Business Growth Diagnostic
- Decision Lab v0.2 with evidence packets, evidence graph, deterministic agent personas, 2–5 reaction rounds, consensus/disagreement analysis, source hashes and JSON report export
- JSON backup/export of local business data
- No third-party analytics, advertising IDs or behavioural profiling
- Independent Cloudflare Worker engine with /api/health

## Architecture

Primary target: IZAKHONO-owned runtime -> EDGE/TLS -> DNS.

External hosting may be used only as a reversible resilience route. The product is packaged as a self-contained Worker application so it can run independently from other IZAKHONO products.

The optional AI adapter is configured with AI_GATEWAY_URL and AI_GATEWAY_TOKEN. If no AI adapter is configured, the application stays useful in local template mode and clearly labels that state. No browser API keys are used.

## Privacy

Business records are local-first in v0.1. The browser stores clients and documents on-device, and the user can export a JSON backup. The app does not load third-party analytics or tracking scripts.

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
