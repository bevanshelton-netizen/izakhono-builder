# J.A.R.V.I.S. Mainline Rebuild

## Purpose
Reintroduce the J.A.R.V.I.S. executive command centre onto the current IZAKHONO Builder mainline without replaying the divergent feature branch or overwriting newer platform work.

## Source-of-truth decisions
- Base: current `main` commit `8bcd0c994b2d854b9741f81788c4653063defb34`; release branch `release/jarvis-mainline-port-v2`.
- Legacy source retained unchanged: `feature/izakhono-jarvis-foundation`.
- The legacy feature branch is source material only and is not deployable. The release port is isolated on a branch based on current main. The CEO authorised completion and deployment on 2026-11-14; production credentials, migration review, CI, and release verification remain mandatory.
- Treat the old branch as source material, not as a deployable release.

## Port sequence
1. **Inventory and compatibility:** compare current Worker entry points, D1 bindings/migrations, authentication/session conventions, routing, and deployment config.
2. **Read-only executive API:** introduce a minimal owner-scoped status and portfolio snapshot using only verified first-party data already available in the current application. Unknown values remain null or explicitly unavailable.
3. **Command-centre UI:** add the J.A.R.V.I.S. interface as an isolated product surface; no changes to existing Builder workflows.
4. **Task and context layer:** port task queue, scoped context, and agent definitions in small independently tested slices.
5. **Approval and audit:** preserve immutable proposals and owner decisions; approval is not execution. Initially permit only internal audit writes.
6. **Connector registry:** expose connection state and permissions honestly. No provider is considered connected until a real adapter and authorised account scope are verified.
7. **Validation and release review:** typecheck, unit tests, security review, migration review, and CI. Deployment is authorised by the CEO on 2026-11-14, subject to CI, security, migration, credential, and post-release verification gates.

## Non-negotiable safety rules
- No provider credentials in browser code.
- No outbound provider calls without an explicit server-side adapter and authorised account scope.
- No financial or operating KPIs inferred from company descriptions.
- No cross-company financial aggregation without reconciled entity, currency, and reporting-period mappings.
- No irreversible external business actions from an agent.
- Every action with external impact requires a separate owner approval and a bounded execution adapter.
- Scheduled jobs must be idempotent, bounded, observable, and safe when configuration is absent.
- Display observed time separately from source update time.
- If data is missing, stale, unauthorised, or unavailable, say so.

## Current known legacy capabilities to port
- Owner-scoped sessions with hashed opaque tokens and secure cookies.
- D1 conversations, messages, and scoped memory.
- Five reasoning-only agents: coordinator, business analyst, research briefing, project planner, reporting.
- Task queue with bounded retries, dependencies, and scheduled dispatch.
- Shared company/project context with explicit task attachment.
- Immutable action proposals and owner decisions.
- Internal audit-only execution.
- Read-only source registry for finance, email, CRM, manufacturing, and education.
- Executive portfolio snapshot and command-centre UI.

## First milestone acceptance criteria
- Clean branch is based on current main.
- J.A.R.V.I.S. is integrated through owner-authorized route modules and an isolated command-centre asset path.
- API responses are owner-scoped and report unavailable integrations honestly.
- Tests cover unauthenticated access, tenant isolation, null metrics, and read-only behavior.
- Existing mainline validation scripts remain unchanged unless a dedicated J.A.R.V.I.S. script can be added without disrupting them.


## Current-mainline release port (2026-11-14)

- Release branch: `release/jarvis-mainline-port-v2`, based directly on current `main`.
- Legacy feature branch is not merged; only J.A.R.V.I.S.-scoped files were ported.
- J.A.R.V.I.S. migrations are renumbered sequentially from `0025` through `0031` after mainline migration `0024`.
- Production release requires CI, full validation, Cloudflare credential presence, migration preflight, and post-deployment health checks.
