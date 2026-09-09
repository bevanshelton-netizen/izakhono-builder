# StudyPal on IZAKHONO

StudyPal is an education application intended to run through the IZAKHONO Builder and reusable Build-to-Alpha gate.

## Target integration

StudyPal source repository should include:

- `.izakhono.json` copied from `templates/studypal.izakhono.json`
- `.github/workflows/izakhono-build-to-alpha.yml` based on `templates/call-izakhono-alpha.yml`
- a `Dockerfile`
- an HTTP `/healthz` endpoint that returns success only when the app is ready

## IZAKHONO-owned service targets

StudyPal should integrate with IZAKHONO-owned modules or service adapters for:

- authentication and role-based access
- PostgreSQL application data
- object/file storage for learner uploads
- AI-provider abstraction with server-side credentials
- usage accounting and plan enforcement
- StudyPal Standard subscription state
- StudyPal Family, School and Sponsored access
- IZAKHONO Pay through a payment adapter rather than browser-trusted payment state

## Account roles

- OWNER
- LEARNER
- PARENT
- TEACHER
- SCHOOL_ADMIN
- SPONSOR_ADMIN
- PLATFORM_ADMIN

Owner access must never be publicly self-selectable.

## Commercial defaults

- Free Starter: R0
- StudyPal Standard: R99/month
- Owner Access: free forever for authorised owner accounts
- Family, School and sponsorship pricing: centrally configurable
- AI usage: metered and centrally configurable; never advertised as unlimited

## Deployment safety

The central IZAKHONO Build-to-Alpha gate must remain the trust boundary. A failed build or health check must not be promoted. Secrets must stay outside source control and browser bundles.

## Current blocker

The current StudyPal/WeLearn Codex source project must be exported or connected to an accessible repository before the manifest and workflow can be installed into the application itself and its Docker build can be verified end to end.
