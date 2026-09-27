# IZAKHONO BUSINESS AI

A privacy-first small-business operating assistant for South African SMEs.

## What is built in v0.1

- Premium responsive landing page and workspace
- Client register stored locally in the user's browser
- Quote and invoice builder with print/PDF export
- Email handoff using the device's configured mail client
- AI correspondence writer with an IZAKHONO-owned/provider-neutral adapter boundary
- Business Growth Diagnostic
- Decision Lab for multi-perspective scenario rehearsal
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
