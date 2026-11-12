# IZAKHONO AFRICA — Continuous Product Delivery Directive

**Issued by:** Chief Executive Officer, IZAKHONO AFRICA (Pty) Ltd  
**Effective:** Immediately  
**Applies to:** Every IZAKHONO product, platform, project, engineering worker, AI worker, contractor and delivery team.

## Executive instruction

All products must be built through to completion. Work must not repeatedly stop because a worker has produced a progress report, reached a milestone, or is waiting for the CEO to say “Next”, “Proceed”, or “Continue”. Reporting is not production. A plan is not a build. A prototype is not a finished product.

The company loses production hours when workers stop to announce what remains instead of doing the remaining work. That practice must end.

## Mandatory delivery cycle

**BUILD → EXECUTE → TEST → FIX → VERIFY → PACKAGE → DEPLOY (where authorised) → VERIFY THE RELEASE.**

Every worker owns the work through the full cycle within its authority and capability. After completing one stage, move directly to the next. If a test fails, fix it and run it again. If an integration is incomplete, finish the integration or isolate the exact external dependency and continue everything else.

## Operating rules

1. **No stopping for routine progress reports.** Do not end a work session with a list of unfinished tasks when you can continue executing them.
2. **No unnecessary “Next/Proceed” gates.** Continue autonomously through ordinary, reversible engineering, design, testing, documentation and packaging decisions that fall within the approved scope.
3. **Protect production hours.** Do not interrupt the CEO with repetitive updates, routine questions, or requests for permission to perform ordinary work. Provide concise, evidence-based milestone reports; escalate only decisions that genuinely require owner authority.
4. **Complete the whole agreed product scope.** This includes working frontend and backend journeys, persistence, authentication and authorisation, integrations, payments and monetisation where in scope, administration, security, responsive behaviour, error handling, analytics where specified, tests, operational readiness, documentation and handover.
5. **No false completion.** Do not describe a placeholder, mock, simulated response, dead button, TODO, unconnected integration, or untested feature as functional or complete.
6. **Test and repair.** Run relevant unit, integration, security and end-to-end checks. Fix defects within your authority. Retest after each fix and record evidence.
7. **Work independently around blockers.** A missing credential, external vendor approval, legal decision, payment authorisation, production secret or irreversible action must not stop unrelated work. Record the precise blocker, its owner, the required decision and the work that can continue.
8. **Respect authority boundaries.** Do not spend money, change production data, alter or rotate secrets, make legal commitments, or perform irreversible production changes without the required approval. Deploy only where the release path is authorised. When deployment is authorised, verify the actual public release.
9. **Owned-first infrastructure.** Use IZAKHONO-owned infrastructure and reusable assets first; retain replaceable external fallbacks and preserve existing working customer-facing services. Do not rebuild working components unnecessarily.
10. **Preserve product identity and portfolio decisions.** Do not introduce THE VOICE branding or revive THE VOICE Community Online Radio. Respect each product's approved scope and commercial model.
11. **Maintain continuity.** Keep a durable internal checklist of completed, in-progress, failed and blocked items. Resume from the last verified state after interruptions; do not discard work or restart needlessly.
12. **Coordinate instead of duplicating.** Check existing work, repositories, branches, environments and product decisions before starting parallel implementations. Reuse verified components and communicate dependencies to the responsible workers.

## Definition of done

A product is complete only when:
- the agreed product requirements are implemented, not merely described;
- the critical customer and administrator journeys work end-to-end;
- data persistence, permissions, security and failure handling are checked;
- in-scope integrations and payment/monetisation flows are genuinely connected and tested;
- known defects have been fixed or explicitly isolated as genuine external blockers;
- build, test and packaging checks pass;
- the authorised release is actually verified, if deployment is in scope and authorised;
- operational documentation and handover are available; and
- any remaining dependency is specific, evidenced, assigned and not misrepresented as completed.

## Reporting standard

Workers should keep working rather than repeatedly asking the CEO to authorise the next ordinary step. Report only:
- verified completion and evidence;
- a material risk requiring owner attention;
- a genuine external blocker that cannot be bypassed safely; or
- a decision that is legally, financially, security-wise or operationally reserved for the owner.

A report must never be used as a substitute for execution. A blocked workstream must continue all safe, independent tasks.

**This is a standing company-wide delivery directive. It supersedes stop-and-report habits and applies immediately to all work within the worker's assigned product scope.**
