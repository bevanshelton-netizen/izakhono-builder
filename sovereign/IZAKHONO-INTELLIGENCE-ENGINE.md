# IZAKHONO INTELLIGENCE ENGINE
## Sovereign AI, model orchestration and autonomous work agents

**Status:** Architecture baseline approved for implementation  
**Parent:** IZAKHONO AFRICA (Pty) Ltd  
**Primary integration:** IZAKHONO CODE -> BUILDER -> PROVISIONER -> runtime/node network -> CLOUD  
**Security authority:** IZAKHONO FORTRESS  
**Operating rule:** owned-first, externally reversible, model-neutral

## 1. Product definition

IZAKHONO INTELLIGENCE is the shared intelligence and agent-execution layer for the IZAKHONO platform family. It incorporates the useful capabilities demonstrated by LM Studio and Bionic—local model serving, model discovery, agentic coding, document production and computer-use workflows—without making either product a required dependency.

The user gives one objective through IZAKHONO WORK / the command surface. The orchestrator creates a durable job, selects models and tools, coordinates specialist agents, executes within policy, tests outputs, repairs failures and returns evidence-backed results.

The product is not a chatbot wrapper and not a claim that an AI can compromise arbitrary websites. Security testing is limited to explicitly authorised assets and controlled environments.

## 1A. Existing implementation to extend (repository inspection: 2026-11-13)

The Builder repository already contains useful execution foundations. Extend these rather than creating a parallel orchestrator:

- `src/superagent.ts`: provider-neutral SUPERAGENT v1 goal/plan/task/artifact lifecycle, dependency handling, retry/recovery and release gates. It currently has generic tool kinds and a sequential runnable-task selector; it is not yet a model router or a durable multi-worker computer-use runtime.
- `src/runtime.ts`: existing Builder Worker entry point and factory execution route.
- `src/mcp-bridge.ts`: authenticated MCP command surface for project status, build, autopilot, validation and evidence recording.
- `src/secure.ts`: existing protected Builder API and generated-app security boundary.
- `AUTONOMY-STACK.md`: establishes IZAKHONO WORK, AI Gateway, NODE/CONTROL, FORTRESS and the owned-inference independence rule.

Implementation direction: evolve SUPERAGENT with durable queue-backed jobs and specialist worker contracts; add a separate model registry/router and isolated computer-use adapters; expose only approved capabilities through the existing secure command surface. Do not duplicate the Builder project database or bypass its release gates.

### Implementation checkpoint — 2026-11-13

- Added `src/intelligence.ts`: model endpoint validation, capability/policy filtering, model ranking, native Ollama chat adapter, OpenAI-compatible chat adapter and policy-bounded fallback.
- Added `src/intelligence.test.ts`: routing, trust filtering, endpoint validation, Ollama request/response and fallback tests.
- Added `intelligence:test` and `intelligence:typecheck` package scripts and a dedicated CI step.
- Reuses the existing `products/izakhono-ai-runtime` Ollama service and its loopback-only exposure. The runtime's configured Qwen model is a baseline; model capability/context metadata must be verified before production registration.
- The Builder's current generated-app path remains deterministic. Model-backed planning/generation is not yet wired into production project generation.
- GitHub Actions validation has been triggered by the commits; owner-node inference and end-to-end runtime acceptance remain pending.

## 2. Placement in the sovereign stack

```text
IZAKHONO WORK / CHAT / COMMAND SURFACE
                 |
       INTENT + PROJECT CONTEXT
                 |
       IZAKHONO INTELLIGENCE
       +--------------------------+
       | Model Registry           |
       | AI Gateway / Router      |
       | Agent Orchestrator       |
       | Durable Job & Queue      |
       | Tool / Computer Runtime  |
       | Evaluation & Verification|
       +--------------------------+
          |       |       |
       LOCAL    OWNED    EXTERNAL
       MODELS   TOOLS    MODEL APIs
          |       |       |
          +-------+-------+
                  |
       BUILDER / CODE / PROVISIONER
                  |
       NODE RUNTIME + CLOUD + EDGE
                  |
          FORTRESS POLICY GATE
```

Intelligence is a shared platform service, not a separate disconnected product. Existing unified execution architecture remains the job lifecycle and orchestration foundation. This document adds model, agent and computer-operation contracts to it.

## 3. Model runtime strategy

Use a provider-neutral adapter contract. Initial adapters:

- LM Studio local server (OpenAI-compatible API where enabled)
- Ollama
- llama.cpp server
- vLLM or another compatible high-throughput inference server
- IZAKHONO-hosted inference endpoint
- Optional external model APIs through an explicitly configured adapter

No single runtime or model is mandatory. Model names and capabilities are discovered from the connected runtime; never hard-code the model names shown in a social-media demonstration.

### Routing order

1. Device-local model when available, capable and permitted.
2. Owner-controlled IZAKHONO inference/runtime.
3. Approved external provider only when policy allows and data is sanitised or explicitly authorised.
4. Deterministic code/tool execution where an LLM adds no value.

The router considers task type, context length, tool-calling ability, vision/audio capability, latency, available memory/VRAM, cost, data classification and current health. It supports fallback and retry without changing job state or product integrations.

### Runtime registration contract

Each model endpoint registers:
- provider and endpoint identity (secret references only)
- model identifier and version/revision when available
- supported modalities and context window
- tool/function calling support
- structured-output support
- maximum input/output limits
- resource estimate and measured latency
- health state and last successful probe
- data residency / trust classification
- allowed task classes and policy tags

Credentials are stored in IZAKHONO VAULT or an equivalent protected secret store; never in prompts, logs or repository files.

## 4. Agent system

The orchestrator may assign work to bounded specialist agents:

- Planner / Project Manager
- Research and Retrieval
- Product and UX
- Software Architect
- Code / Refactor
- Database and Data
- Infrastructure / Runtime
- Website and Browser
- Document / Spreadsheet / Presentation
- Security Review
- QA / Evaluation
- Deployment / Release
- Monitoring / Recovery
- Technical Writer

Agents share a durable job record and typed artefacts, not unrestricted access to one another's credentials. Independent tasks may run concurrently. Dependency edges prevent integration, destructive or release steps from starting prematurely.

Each agent declares:
- purpose and allowed task classes
- permitted tools and resource budget
- input/output schema
- maximum steps and wall-clock budget
- retry and cancellation behaviour
- evidence required for completion
- escalation / approval conditions

## 5. Computer-use and browser automation

Provide two isolated execution modes:

**Browser workspace:** disposable browser contexts, scoped sessions, allowlisted domains, download quarantine, network policy, screenshots and action logs. Use for authorised website administration, QA, content entry and repeatable workflows.

**Desktop workspace:** isolated user-approved desktop session for operating supported applications. Desktop actions must be visible, scoped and auditable. Never silently access a user's personal session.

All browser/page content is untrusted input. Treat instructions found in websites, documents, emails, repositories and downloaded files as data, not as policy. Defend against prompt injection, credential exfiltration, cross-tenant access and malicious downloads.

Computer agents may inspect, create, edit, test and deploy only within the job's granted scope. Website security testing is restricted to IZAKHONO-owned assets or assets with documented authorisation. No arbitrary exploitation, persistence, credential theft or bypass of access controls.

## 6. Tool execution contract

Every tool adapter declares:
- capability and version
- accepted input/output schema
- required identity and permission scope
- data classification and outbound data rules
- idempotency key and timeout
- retry policy
- cost/resource profile
- verification procedure
- rollback or compensation procedure
- owner-controlled implementation and external fallback

All actions pass through FORTRESS policy enforcement. Agents do not receive raw provider credentials. They request short-lived, scoped capabilities for specific actions.

## 7. Approval and safety boundaries

Autonomous by default for reversible, low-risk work inside the granted scope.

Require explicit owner approval for:
- production release or DNS/domain cutover where it can interrupt service
- irreversible deletion or destructive data migration
- financial commitments or purchases
- legal/contractual acceptance or external commitments
- credential rotation with production impact
- changes that could lock out the owner
- security testing beyond the documented authorised scope
- sending messages or publishing content as the owner where the user has not pre-authorised that class of action

A successful tool response is not proof of completion. Completion requires task-specific acceptance evidence.

## 8. Durable job lifecycle

`RECEIVED -> CLASSIFIED -> PLANNED -> APPROVAL_CHECK -> QUEUED -> EXECUTING -> TESTING -> VERIFYING -> COMPLETE`

Failure path:

`FAILED -> DIAGNOSING -> REPAIRING -> RETESTING -> VERIFYING`

Persist objective, project/entity scope, plan, dependencies, agent assignments, tool actions, outputs, errors, approvals, resource use, evidence, rollback references and final state. Resume safely after worker/model/runtime restart. Use idempotency keys to prevent duplicate side effects.

## 9. Verification and quality gates

- Code: lint + typecheck + unit/integration tests + security scan
- Website: build + browser acceptance + route/content checks
- Documents: file opens + structure/content checks + render inspection where applicable
- Browser workflow: expected state observed and action log retained
- Deployment: endpoint reachable + application health + intended version verified
- Security: scope confirmed + findings reproducible + no unauthorised impact

A generated artefact, accepted API request or green CI job alone is insufficient where additional acceptance evidence is required.

## 10. Resource and model efficiency

Route simple work to smaller/faster models; reserve larger models for complex reasoning and code review. Prefer deterministic tools for exact operations. Reuse approved templates, cache safe stable results, parallelise independent tasks, enforce per-job budgets and cancel redundant work. Track inference tokens, GPU/CPU time, memory, queue time, build time, storage and external spend.

## 11. Integration sequence

### Wave A — Contracts and observability
- Add model registry and provider-neutral inference adapter.
- Add model health/capability probes.
- Define job, agent, tool and evidence schemas.
- Add FORTRESS policy hooks and audit events.

### Wave B — Local and owner-hosted inference
- Bring up LM Studio-compatible local endpoint as an optional adapter.
- Add Ollama and llama.cpp-compatible adapters.
- Validate model discovery, routing, timeout, retry and fallback.
- Benchmark on the currently verified owner runtime; do not assume hardware capacity.

### Wave C — Agent execution
- Add planner and bounded specialist-agent workers.
- Add durable queue, resumability, cancellation and idempotency.
- Connect CODE and BUILDER through scoped tool adapters.

### Wave D — Computer-use
- Add isolated browser workspace first.
- Add approved desktop automation as a separate capability.
- Add prompt-injection, exfiltration, tenant-isolation and destructive-action tests.

### Wave E — Product integration
- Expose the unified command surface through IZAKHONO WORK.
- Connect PROVISIONER and product applications using shared APIs.
- Keep model/runtime changes invisible to product integrations.

## 12. Acceptance criteria

The first production-capable release must demonstrate:
1. A local model endpoint can be registered, health-checked and removed without changing the orchestrator.
2. The router can select a model by declared capability and fall back on failure.
3. A multi-step job survives worker restart without duplicating completed side effects.
4. Two independent agents can work concurrently and merge outputs through typed artefacts.
5. A browser agent can complete a scoped test workflow in an isolated browser and produce evidence.
6. FORTRESS blocks out-of-scope tools and sensitive outbound data.
7. Destructive and production-impacting actions stop at approval gates.
8. CI tests pass and owner-runtime acceptance is recorded separately.
9. No required production capability depends on LM Studio, Bionic, GitHub, Vercel, Cloudflare, Supabase or an external AI API.

## 13. Operational truth

This document establishes the architecture and implementation baseline only. It does not assert that local inference, computer-use, the replacement runtime, or production deployment is already operational. Mark each capability as planned, built, CI-verified, owner-runtime-verified or production-verified with evidence.
