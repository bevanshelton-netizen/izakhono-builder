# IZAKHONO ONE Agent and Browser Capability Inventory — V1

**Status:** Read-only repository inventory; architecture guidance only.  
**Repository inspected:** `bevanshelton-netizen/izakhono-builder`, default branch `main`.  
**Inspection mode:** GitHub repository tree and selected source files; no code executed and no environment provisioned.

## 1. Findings

The repository already contains useful agent and orchestration foundations, but the inspected components do not establish that a general-purpose isolated browser agent is implemented.

### 1.1 Existing autonomy planner and worker

The `autonomy/` area contains:

- `ai-agent.mjs` — creates plans, persists plan state and queue state as JSON, and supports explicit or inferred steps.
- `ai-agent-planner.mjs` — infers a set of builder-oriented steps from a goal.
- `ai-agent-worker.mjs` — dispatches supported steps to existing Node or builder adapters and records progress/results.
- related tests and adapters for agent, planner, worker, Node and builder behavior.

The current worker's visible action routing is for Node and builder operations. The inspected code does not expose a browser-session controller, per-task browser context, URL/redirect policy or visible-page extraction interface. Its JSON plan/queue persistence is not, by itself, the durable transaction/audit authority required for a production personal agent.

**Reuse boundary:** retain the planner/worker concepts and existing test conventions where appropriate. Do not route browser actions through generic unsupported actions or treat the current queue/state files as the final browser security or audit boundary.

### 1.2 Existing IZAKHONO NAV

The `apps/izakhono-nav/` area contains a navigation product with voice, multimodal, hazard and freight-operation features. Its current naming and purpose indicate navigation/user-experience functionality; the inspected tree does not establish a general-purpose Chromium browser automation runtime.

**Reuse boundary:** NAV may later be an entry point or user-facing surface, but it is not assumed to be the personal agent's browser engine.

### 1.3 Browser automation dependency/runtime

A targeted repository-tree search for browser, Playwright, Puppeteer and agent-related paths did not identify an existing dedicated personal-agent browser package or browser automation dependency manifest. This is a bounded inventory finding, not proof that no browser-related code exists anywhere in the repository.

Before adding a dependency, inspect the applicable workspace manifests, lockfiles, CI conventions and security policy; pin a reviewed version and include licence/provenance and dependency checks.

## 2. Architectural conclusion

The personal-agent browser should be introduced as a distinct, typed capability rather than overloading:

- the existing NAV application;
- NODE01 identity or Node agent;
- the builder adapter;
- the existing generic autonomy worker;
- an external AI Commander relay.

Suggested product boundary:

`products/izakhono-one/agent-browser/`

This is a proposed location, not a created or approved implementation path. Confirm repository product conventions and ownership before adding code.

## 3. Integration design

1. The IZAKHONO ONE task gateway authenticates and scopes the user task.
2. The planner creates a bounded read-only research plan.
3. A dedicated browser adapter receives a task ID and immutable browser policy.
4. The adapter creates a fresh isolated browser context for that task.
5. URL and redirect policy is enforced in the controller, not delegated to the model.
6. Only title, final URL and bounded visible text are returned to the planner.
7. The task result and redacted audit event are recorded through the approved authority.
8. Browser context is closed and ephemeral data removed in all terminal states.

The existing autonomy worker may later call the typed browser adapter only after capability registration, policy integration and tests are in place. This inventory does not authorise that connection yet.

## 4. Gaps to resolve before implementation

- Confirm canonical product directory and package conventions.
- Confirm approved browser library and exact pinned version.
- Identify existing trusted policy and audit APIs suitable for the adapter.
- Define the browser tool schema and capability registration contract.
- Establish safe URL validation and redirect interception.
- Define isolated context lifecycle and ephemeral data cleanup.
- Add local fixture pages and deterministic security tests.
- Establish CI workflow and test commands.
- Ensure the Node execution binding remains separate from browser session identity.
- Ensure no write/action or shell tools are registered in the read-only POC.

## 5. Recommended next implementation increment

Create a standalone read-only browser adapter with no LLM dependency, no user account integration, no remote command tools and no external service dependency. First implement URL policy and local fixture tests; then add browser launch, isolated context, visible-text extraction and cleanup.

Do not integrate it into the general autonomy worker until its security tests pass and the adapter contract is reviewed.

## 6. Safety statement

This inventory is documentation-only. No code, dependency, package manifest, workflow, runtime, browser, host, credential, subscription, production account or production state was changed. No test was run and no implementation status is claimed.
