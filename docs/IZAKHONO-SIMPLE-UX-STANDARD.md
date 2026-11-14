# IZAKHONO SIMPLE USER EXPERIENCE STANDARD

**Project:** IZAKHONO BUILDER  
**Project ID:** IZB-CORE  
**Classification:** IZAKHONO AI / Core Platform  
**Status:** Approved design direction; implementation and verification remain separate gates.

## 1. Product principle

**Enterprise-grade intelligence behind the scenes. Effortless simplicity for the user.**

The system must make sophisticated capabilities feel straightforward. Simplification applies to the experience, not to security, reliability, governance, testing, or architectural quality.

## 2. Primary user journey

The default experience should guide a user through five understandable stages:

1. **Start** — one clear prompt: “What would you like to do?”
2. **Describe** — accept plain language; ask only for information that is genuinely required.
3. **Review** — show a short, readable summary of what will happen, its impact, and any cost or permission implications.
4. **Approve** — request human approval only for actions that require it. Never imply approval or perform gated actions without it.
5. **Track** — show progress, the current stage, the result, and any action needed from the user.

Where safe and appropriate, the system should infer defaults, reuse known project context, and complete routine steps automatically.

## 3. Navigation

Use a small, stable primary navigation:

- **Home** — current priorities, recent work, and a single start action.
- **Projects** — projects, products, and their status.
- **Work** — tasks, approvals, and activity in progress.
- **Agents** — specialist agents and their assigned work, with technical detail hidden by default.
- **Settings** — account, workspace, permissions, integrations, and preferences.

Do not expose every internal service, queue, agent, database, or infrastructure component as a top-level navigation item. Put advanced controls in clearly labelled detail or administration views.

## 4. Plain-language interaction

- Prefer everyday language over internal engineering terms.
- Explain errors in terms of what happened and what the user can do next.
- Avoid asking users to repeat information already available and authorised for reuse.
- Use sensible defaults and progressive disclosure.
- Keep forms short; ask one essential question at a time unless a compact grouped form materially reduces effort.
- Make destructive, financial, security-sensitive, external-publication, and access-changing actions explicit and appropriately gated.
- Never hide material consequences behind simplified wording.

## 5. Status and feedback

Every task should have a human-readable status:

- **Queued** — waiting to start.
- **In progress** — work is underway.
- **Needs your approval** — a decision is required.
- **Needs attention** — a genuine blocker needs intervention.
- **Completed** — finished, with verifiable evidence.
- **Could not complete** — explain the reason and safe next step.

Show progress by meaningful stage, not fabricated percentages. Distinguish completed work from attempted work, and verified outcomes from unverified claims. Provide a concise result first, with technical logs and evidence available on demand.

## 6. Mobile-first and accessibility

- Design for narrow phone screens first, then expand for tablet and desktop.
- Use readable text, clear labels, large touch targets, and consistent placement.
- Avoid dense tables and horizontally scrolling layouts on mobile; provide simple summaries and drill-down details.
- Support keyboard navigation, visible focus, semantic controls, sufficient contrast, and reduced motion.
- Keep primary actions visible and avoid clutter, unnecessary animation, and decorative complexity.

## 7. Personalisation and continuity

- Maintain project context and task history so users do not need to restate decisions.
- Respect permissions and workspace boundaries when reusing context.
- Preserve canonical project names, IDs, portfolio classifications, and distinct product identities.
- Present the next useful action without forcing users through technical setup.

## 8. Non-negotiable engineering standards

A simple interface must not weaken the platform's enterprise requirements:

- Authentication, least-privilege authorisation, tenant isolation, and secure secret handling.
- Auditable actions, approvals, agent decisions, and state transitions.
- Durable workflows, idempotency, bounded retries, failure recovery, and clear escalation.
- Evidence-backed completion and independently reproducible tests.
- Responsive layouts, performance budgets, and graceful degradation.
- Provider-agnostic architecture and independent data portability.
- No false claims of background execution, deployment, success, or verification.

## 9. Acceptance criteria

The experience is not accepted until tests demonstrate:

1. A first-time user can identify how to start a task without training.
2. A routine task can be described in plain language without navigating technical configuration.
3. The user can see what is happening and what, if anything, is required from them.
4. Approval-gated actions cannot proceed without the required authorisation.
5. Failures explain the issue and a safe next step.
6. Core journeys work at mobile, tablet, and desktop breakpoints.
7. Accessibility checks cover keyboard use, labels, focus, contrast, and reduced motion.
8. Task history and project identity remain correct across sessions and workspaces.
9. Automated tests cover navigation, task creation, status transitions, approvals, errors, and responsive behaviour.
10. Release claims are supported by test results and deployment evidence; a written specification alone is not proof of implementation.

## 10. Delivery sequence

1. Audit the existing Builder screens and journeys before changing them.
2. Map current screens and controls to this standard; identify duplication and friction.
3. Implement the simplified information architecture and primary task journey in the existing application.
4. Add accessible mobile-first layouts and clear status feedback.
5. Test security gates, permissions, recovery, and end-to-end user journeys.
6. Fix failures, rerun tests, capture evidence, and package a release candidate.
7. Deploy only after required checks and release approvals pass.

**Important:** This standard does not authorise a parallel Builder, a new competing product, or removal of existing capabilities. Simplify the presentation while preserving the underlying capabilities and approved product boundaries.
