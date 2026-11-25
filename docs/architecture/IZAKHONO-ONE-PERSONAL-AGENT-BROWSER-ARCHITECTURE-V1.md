# IZAKHONO ONE Personal Agent and Browser Architecture — V1

**Status:** Proposed architecture decision for IZAKHONO ONE v1.0; documentation only.  
**Scope:** Personal agent, independently controlled browser automation, and optional remote-execution adapter compatibility.  
**Cost policy:** Zero spend. No subscriptions, compute provisioning, paid licences, external relay dependency, production deployment or data migration is authorised by this document.

## 1. Decision

IZAKHONO ONE v1.0 will include a first-class personal-agent capability with an independently controlled browser runtime. The browser agent is an IZAKHONO-owned product capability, not a wrapper that requires a third-party agent service to operate.

The architecture will also define an **optional AI Commander-compatible execution adapter**. This adapter may connect authorised IZAKHONO workloads to remote execution environments through a supported protocol such as MCP, but it is not required for core agent or browser operation.

The two capabilities are distinct:

- **Browser agent:** navigates and interacts with websites through its own controlled browser session.
- **Execution adapter:** invokes narrowly scoped, authorised operations in a separately identified execution environment, such as command jobs or approved file operations.
- **IZAKHONO governance:** remains the authority for identity, permissions, approvals, secrets, workload bindings, audit and revocation.

No external product, relay, model provider or hosting provider becomes a mandatory control plane.

## 2. Product objective and v1.0 user experience

The personal agent should let an authorised user delegate multi-step work in natural language, inspect the proposed plan, observe progress and review the result.

The initial v1.0 capability set is:

1. Start and manage a user-scoped agent session.
2. Use an isolated browser profile and browser context owned and managed by IZAKHONO.
3. Navigate websites, search, read pages, follow links and interact with ordinary page controls.
4. Extract and organise information with source URLs and timestamps where available.
5. Fill forms and prepare transactions, but require explicit user confirmation before submission or other consequential actions.
6. Download and upload files only through explicit policy-controlled workflows.
7. Maintain user-controlled task context and memory with clear scope, retention and deletion rules.
8. Present an action history, current task state, errors and a concise completion report.
9. Support cancellation, timeout, recovery and safe hand-off to the user.
10. Expose optional, separately permissioned execution tools through adapter interfaces.

The v1.0 release does not promise unrestricted autonomous operation across every website. Unsupported authentication challenges, CAPTCHAs, payment steps, destructive actions and sensitive account changes must be handed back to the user or blocked according to policy.

## 3. Logical architecture

The agent is a software capability. Its browser is a managed browser process/context, not a dedicated physical computer. Execution environments are separately identified and authorised under the IZAKHONO Node-to-Execution Binding Contract.

Suggested components:

- **Agent Gateway:** authenticates the user and accepts tasks.
- **Planner / Orchestrator:** converts a request into a bounded plan and manages task state.
- **Policy and Approval Interface:** evaluates requested actions and obtains required user or authority approvals.
- **Browser Controller:** exposes typed browser actions such as navigate, inspect, click, type, wait, capture and download.
- **Isolated Browser Runtime:** runs a managed Chromium-compatible browser context with per-user/session isolation.
- **Context and Memory Service:** stores only approved, scoped task context and user-authorised memories.
- **Tool Registry:** publishes typed capabilities and their permission requirements.
- **Execution Adapter Layer:** optional integrations for external or self-operated execution environments.
- **Audit and Evidence Service:** records task, policy, approval, tool and result events.
- **User Review Surface:** displays plans, approval prompts, browser activity, files and final results.

These are logical software components and may share an execution environment initially. Their logical separation must remain explicit even when deployed together.

## 4. Browser isolation and trust boundaries

Every browser session must be isolated from other users and unrelated sessions. At minimum:

- use a separate browser context/profile and storage namespace per user/session;
- isolate cookies, local storage, cache, downloads and temporary files;
- prevent a web page from accessing host files, internal control-plane credentials or another user's session;
- apply network egress policy and block prohibited private/internal destinations unless specifically authorised;
- deny access to cloud instance metadata and internal administration endpoints by default;
- restrict browser debugging and remote-control endpoints to the trusted controller;
- use bounded resource, time and concurrency quotas;
- clear ephemeral session data according to the retention policy;
- store persistent user-authorised data only in the designated IZAKHONO data boundary.

Browser automation must not be treated as a trusted source of instructions. Web pages, documents, emails, downloaded files and tool outputs are untrusted input. Prompt-injection content must never override system policy, user intent, tool permissions or approval requirements.

The agent must distinguish between reading content and taking action. A page saying “ignore prior instructions”, requesting secrets, or asking the agent to execute unrelated commands is data to be evaluated, not an instruction with authority.

## 5. Action classes and approval policy

Actions must be classified before execution.

| Class | Examples | Default policy |
|---|---|---|
| Read-only | Open a public page, search, inspect page text | May proceed within session policy |
| Reversible interaction | Navigate, sort, filter, expand a page section | May proceed within session policy |
| Prepared change | Fill a form, compose a message, stage an upload | Prepare and show the user before submission |
| Consequential action | Send, publish, submit, purchase, book, change account settings | Explicit user confirmation immediately before action |
| Destructive / privileged | Delete data, change access, run commands, alter infrastructure | Deny by default; require separate authority and approval |

A user's broad instruction to “handle this” does not remove the approval requirement for consequential or destructive operations. Approval must be bound to the specific action, target, material parameters and current session. Material changes invalidate the approval.

## 6. Optional AI Commander-compatible execution adapter

AI Commander compatibility is an optional adapter, not the agent's foundation and not a dependency for browser automation.

The adapter may expose narrowly typed operations where the connected service supports them, for example:

- list authorised execution targets;
- inspect target status and declared capabilities;
- start an approved, bounded job;
- inspect job status and logs;
- retrieve an explicitly requested output file;
- transfer a file only where separately enabled and authorised;
- cancel a job where supported.

The adapter must not expose unrestricted remote shell access to the general-purpose browser agent. If a remote command facility exists behind the adapter, it must be gated by a distinct command-execution permission, explicit target binding, allow-listed operation or reviewed job definition, scoped credentials, approval, timeout, idempotency and audit.

### 6.1 External relay and service dependency

AI Commander describes an outbound-only host agent that connects to a hosted relay, with commands running under the operating-system permissions of the connected host. This introduces an external service, account, relay availability and host-permission dependency.

Therefore:

- AI Commander is optional and replaceable.
- No IZAKHONO service may require its relay for normal operation.
- No private machine code, credentials or access token may be committed to the repository or exposed to the model.
- The adapter must report relay/target unavailability as unavailable, never as successful execution.
- The connected target must be separately registered as an execution environment and explicitly authorised.
- The adapter must respect FORTRESS policy, NODE01 orchestration authority and the Node-to-Execution Binding Contract.
- No automatic purchase, paid-tier activation, host installation or billable job is authorised.
- Free-tier limits and terms must be verified before any operational trial.

### 6.2 Adapter lifecycle

The adapter lifecycle is:

DISCOVERED → REVIEWED → CONFIGURED → AUTHORISED → AVAILABLE

It may transition to SUSPENDED, REVOKED or UNAVAILABLE. Discovery or successful connection does not constitute authorisation. Only an authorised adapter may accept approved operations.

## 7. Identity, authority and integration boundaries

The design must reuse established IZAKHONO authority rather than create a competing identity or policy system:

- **FORTRESS:** policy, identity and approval authority according to the canonical repository architecture.
- **NODE01 / Runtime Fabric:** orchestration and workload-state authority according to the canonical repository architecture.
- **IZAKHONO Node:** stable logical software identity, never a hostname, browser process, VM, container or physical machine.
- **Execution environment:** separately identified and authorised runtime boundary.
- **HOST / MAIL / other products:** retain their own product and service contracts.
- **Agent:** acts for an authenticated user within delegated, revocable scope; it does not become the owner of that user's authority.

Before implementation, reconcile this document with the canonical identity standard, FORTRESS implementation, NODE01/Runtime Fabric contracts and the Node-to-Execution Binding Contract. Where a canonical authority is not yet implemented, record the gap; do not claim it exists.

## 8. Data, credentials and memory

- Credentials must be stored in a managed secret boundary, not in prompts, browser notes, source code, logs or ordinary task memory.
- Secrets must be scoped to a user, integration, task and target as appropriate.
- Prefer delegated OAuth or narrowly scoped tokens over password reuse.
- The agent must not reveal credentials in page content, model context, audit records or completion summaries.
- Task context, durable memory, browser storage and downloaded files are separate data classes with separate retention rules.
- Users must be able to inspect and revoke connected accounts and clear agent memory/session data.
- Sensitive data must not be copied to an external model or relay unless the user-authorised data policy explicitly permits it.

## 9. Reliability, observability and recovery

Each task must have a unique task ID, authenticated actor, created/updated timestamps, state, current step, tool-call references and final outcome.

Minimum task states:

QUEUED → PLANNING → AWAITING_APPROVAL → RUNNING → SUCCEEDED

Alternative terminal or holding states include FAILED, CANCELLED, TIMED_OUT, BLOCKED and NEEDS_USER.

The system must:
- make tool calls idempotent where possible;
- distinguish accepted, running, succeeded, failed and unknown outcomes;
- never treat a timeout as proof of success;
- preserve enough audit evidence to explain what happened without logging secrets;
- support safe cancellation and session cleanup;
- resume only from a validated checkpoint and re-evaluate expired approvals;
- provide a user-readable explanation when a task is blocked or requires human action.

## 10. Open-source component evaluation and supply-chain controls

Nod and other open-source personal-agent/browser projects may be evaluated as implementation references or candidate components. No project is approved for direct adoption by this architecture decision.

Before reuse, record:

- canonical repository and exact upstream project identity;
- licence and attribution obligations;
- dependency and transitive dependency licences;
- release/tag/commit pinned for evaluation;
- security posture, open vulnerabilities and maintenance activity;
- browser isolation and credential-handling design;
- telemetry, external network calls and data flows;
- build provenance, checksums and software bill of materials;
- required modifications and whether a maintained fork is necessary.

Do not assume that a project name, website or marketing description establishes its licence or security properties. No source code is copied into IZAKHONO until this review is complete.

## 11. v1.0 acceptance gates

| Gate | Required evidence | Failure outcome |
|---|---|---|
| Identity | Authenticated user and scoped agent session | Reject task |
| Browser isolation | Cross-session and host-boundary tests pass | Block browser runtime |
| Policy | Action classification and approval enforcement tests pass | Block consequential actions |
| Prompt injection | Untrusted page content cannot override policy | Block release |
| Secrets | No secret leakage in prompts, logs, artifacts or page output | Block release |
| Audit | Task, tool, approval and result events correlate | Block release |
| Reliability | Cancellation, timeout, restart and recovery tests pass | Block release |
| Adapter | Optional adapter disabled by default and separately authorised | Keep adapter unavailable |
| Open source | Licence, provenance and dependency review complete | Do not adopt component |
| Cost | Zero-cost operation confirmed or separate written owner approval | Block paid provisioning |
| Product acceptance | User-visible plan, progress, approval and result review works | Keep out of v1.0 release |

## 12. Phased delivery

1. **Architecture and inventory:** map existing agent, browser, Node, policy, audit and secret-management components; identify overlaps and gaps.
2. **Safe browser proof of concept:** isolated browser, read-only navigation and extraction, session cleanup and audit.
3. **User-controlled workflows:** form preparation, file handling and action-specific confirmation.
4. **Personal-agent experience:** task planning, progress, scoped memory, cancellation and recovery.
5. **Optional execution adapter:** implement a typed adapter contract and begin with read-only discovery; add job execution only after separate authorisation.
6. **Hardening and release:** security tests, prompt-injection tests, supply-chain review, operational evidence and v1.0 acceptance.

## 13. Explicit non-goals and prohibitions

This decision does not:

- authorise a paid AI Commander subscription or lifetime purchase;
- authorise installation of a host agent on any machine;
- authorise remote shell execution or arbitrary command execution;
- provision compute, create physical machines or assign one machine per Node;
- make a third-party relay, model provider or open-source project mandatory;
- authorise production browser automation against real customer accounts;
- authorise purchases, payments, bookings, messages or public posts without action-specific confirmation;
- authorise production deployment, DNS changes, data migration or credential changes;
- claim that the browser agent or execution adapter has been implemented or deployed.

**Current status:** architecture decision proposed for v1.0. Repository documentation only. No runtime, browser, host, relay, subscription, credential, DNS, mail, database or production state has been changed.
