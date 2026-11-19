# IZAKHONO Website Factory v1

The Website Factory is the portfolio-facing entry surface for IZAKHONO BUILDER. It directs the owner to the existing authenticated Builder "Build Anything" panel for project creation. It does not create fake job IDs, collect business data, store credentials, or call owner-only APIs without the established Builder authorization flow.

## Production contract

- The Website Factory page is a navigation/intake surface, not an independent provisioning backend.
- The existing Builder dashboard remains the only owner-authenticated project creation surface.
- No admin secret, recovery credential, API key or payment data is collected or stored by this page.
- The native Node Builder supports deterministic multi-file templates and a private Ollama-compatible model adapter.
- The legacy Worker handoff currently uses deterministic generation and does not perform model inference. Unifying the production handoff with the native runtime is part of the owned HOST cutover.
- NODE01 is a logical software/runtime identity, not a physical server.
- Release candidates remain private until owned HOST, DNS/TLS, backup/restore and end-to-end acceptance evidence passes.

## Build and serve

Run `npm run website-factory:build` from the repository root. This verifies the safe navigation contract and copies the canonical `website-factory/index.html` into `public/website-factory/index.html` for static delivery.

Open `/website-factory/` on the Builder origin. The Open authenticated Builder link opens `/#buildAnything`, where the existing owner authentication and Build Anything API are used.

## Release boundary

The navigation surface and native Builder template catalog are implemented. A separate customer-facing public order API, payment activation, custom-domain provisioning, DNS delegation, SSL, mail provisioning and public deployment remain separately gated HOST/Provisioner capabilities. A generated release candidate is not a production deployment.
