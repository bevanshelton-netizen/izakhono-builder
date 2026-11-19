# IZAKHONO Website Factory v1

The Website Factory is the owner-operated intake surface for the native IZAKHONO BUILDER. It submits a structured website brief to the authenticated `POST /api/build-anything` route and displays the resulting project, validation, internal-repository and release-candidate evidence.

## Production contract

- One authorized owner request becomes one structured website build job.
- The frontend sends no owner secret; it relies on the same-origin authenticated Builder session.
- Unauthenticated requests receive HTTP 401 and do not create a job.
- The Worker handoff currently uses deterministic multi-file generation and does not perform model inference. The native Node Builder runtime separately supports the private Ollama-compatible adapter; unifying the production handoff with that runtime is part of the owned HOST cutover.
- If local inference is unavailable, the Builder uses deterministic native generation; it never switches to a hosted inference provider.
- NODE01 is a logical software/runtime identity, not a physical server.
- Release candidates remain private until owned HOST, DNS/TLS, backup/restore and end-to-end acceptance evidence passes.

## Build and serve

Run `npm run website-factory:build` from the repository root. This verifies the safe DOM/API contract and copies the canonical `website-factory/index.html` into `public/website-factory/index.html` for same-origin static delivery.

Open `/website-factory/` on the authenticated Builder origin. The form does not accept API keys, passwords, payment details or owner credentials.

## Release boundary

The intake UI and Builder handoff are implemented. Customer-facing public order intake, payment activation, custom-domain provisioning, DNS delegation, SSL, mail provisioning and public deployment remain separately gated HOST/Provisioner capabilities. A generated release candidate is not a production deployment.
