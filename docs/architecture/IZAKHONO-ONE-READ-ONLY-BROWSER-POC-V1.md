# IZAKHONO ONE Read-Only Browser Proof of Concept — V1

**Status:** Implementation specification; proposed, not implemented.  
**Parent architecture:** `IZAKHONO-ONE-PERSONAL-AGENT-BROWSER-ARCHITECTURE-V1.md`  
**Target release:** IZAKHONO ONE v1.0  
**Execution posture:** Local or otherwise explicitly authorised test environment only; no production accounts or real-user data.  
**Cost posture:** Zero spend. No hosted browser, paid model, relay, server or subscription is authorised.

## 1. Purpose

Define the smallest safe browser-agent proof of concept (POC) that demonstrates IZAKHONO can create an isolated browser session, visit explicitly allowed public pages, extract visible information and return a traceable result.

The POC is a read-only research tool. It is not yet an autonomous personal agent and does not implement the complete v1.0 architecture.

## 2. POC boundary

### In scope

- One authenticated test user/session, or a local test harness with no external identity dependency.
- A managed Chromium browser launched by the POC controller.
- One ephemeral browser context per task.
- Navigation to explicitly allowed public HTTP(S) test pages.
- Read-only page title, URL and visible-text extraction.
- A bounded sequence of navigation steps.
- Task timeout, cancellation, browser shutdown and temporary-data cleanup.
- Structured result and redacted audit events.
- Deterministic tests using local fixture pages.

### Explicitly out of scope

- Login, cookies imported from a personal browser, password entry or account linking.
- Clicking buttons, submitting forms, sending messages, publishing, purchasing, booking or changing account settings.
- File upload/download, clipboard, screenshots or screen control.
- Shell access, remote command execution, AI Commander connection or machine-code handling.
- Production deployment, customer accounts, production data, paid APIs or paid infrastructure.
- Unrestricted browsing, arbitrary network destinations or autonomous task loops.
- Persistent cross-session memory.

## 3. Minimal software interfaces

The POC should define typed interfaces before selecting or adopting a browser library.

### BrowserSession

- `open(task_id, policy)` — create a fresh isolated browser context.
- `navigate(url)` — navigate only after URL policy validation.
- `read_page()` — return title, final URL and bounded visible text.
- `close()` — close context and remove ephemeral profile data.

### BrowserPolicy

Required policy fields:

- allowed URL schemes: HTTPS by default; HTTP only for local test fixtures;
- allowed hostnames or test-fixture origin list;
- maximum navigation count;
- maximum page/text size;
- navigation and overall task timeout;
- redirect limit;
- blocked destination classes;
- explicit read-only mode, fixed to true in this POC.

Policy is supplied by the trusted controller and cannot be widened by page content or model output.

### ReadOnlyAgent

- accept a user task that is explicitly limited to public-page research;
- produce a bounded list of URLs to inspect;
- ask the browser controller to navigate and read;
- summarise only the returned page data;
- include source URL and task ID in the result;
- return `BLOCKED` or `NEEDS_USER` when a request requires interaction or access beyond policy.

The POC may use a deterministic scripted plan before any LLM planner is integrated. A model is not required to prove browser isolation and page extraction.

## 4. Destination and network security

The browser controller must validate every navigation and redirect, not only the initial URL.

- Permit only approved schemes and exact or explicitly matched hostnames.
- Reject embedded credentials, malformed URLs and unexpected ports.
- Block loopback, private, link-local, multicast and reserved IP ranges except the local test fixture origin.
- Block cloud metadata endpoints and internal control-plane destinations.
- Resolve and validate destinations at connection time where the runtime supports it; protect against DNS rebinding and redirects to prohibited addresses.
- Re-check each redirect destination.
- Do not expose browser debugging ports outside the local trusted controller.
- Do not allow page JavaScript to call agent tools, host APIs or policy endpoints.
- Do not place secrets in browser context, page scripts, URLs or extracted text.

The POC should use a local fixture server for security tests. Public-web access should be an optional test mode, disabled by default.

## 5. Untrusted page content and prompt injection

All page text is untrusted data. It may be summarised or quoted as content, but it cannot:

- change system or developer policy;
- expand the allow-list;
- request credentials or local files;
- authorise tools or execution;
- approve an action;
- cause the controller to follow arbitrary links;
- change task scope.

If the POC includes an LLM, page content must be passed as a clearly separated untrusted data field. Tool availability remains controlled by the application, not by model-generated instructions.

## 6. Result and audit records

A successful read-only task returns:

- task ID;
- status;
- requested URL and final URL;
- page title;
- bounded extracted text;
- capture timestamp;
- navigation count;
- policy version;
- error or block reason, if applicable.

Audit events should record task start/end, policy decision, navigation attempt/result, page-read completion, cancellation and cleanup. They must not record credentials, raw browser storage, full unbounded page content or sensitive headers.

## 7. State model

Minimum task states:

`CREATED → POLICY_CHECK → RUNNING → READING → SUCCEEDED`

Alternate states:

`BLOCKED`, `FAILED`, `CANCELLED`, `TIMED_OUT`, `NEEDS_USER`.

A timeout or lost browser process must not be reported as success. Every terminal state must trigger browser-context cleanup.

## 8. Acceptance tests

The POC is acceptable only when the following tests pass in a repeatable local test environment.

### Functional

1. Opens a permitted local fixture page and returns its title, final URL and visible text.
2. Follows a bounded sequence of permitted read-only navigations.
3. Preserves source URLs in the result.
4. Rejects an unsupported interaction request with `NEEDS_USER` or `BLOCKED`.
5. Closes the browser context after success, failure, cancellation and timeout.

### Isolation and destination safety

6. Two concurrent tasks cannot read each other's cookies, local storage or page state.
7. Navigation to loopback/private/link-local/reserved destinations is blocked except the explicitly configured fixture origin.
8. A permitted public URL redirecting to a prohibited destination is blocked.
9. Embedded credentials, disallowed schemes and unexpected ports are rejected.
10. Browser debugging/control endpoints are not exposed to untrusted interfaces.

### Prompt-injection and policy

11. A fixture page containing “ignore previous instructions” cannot alter policy or invoke tools.
12. Page text requesting secrets or local files produces no secret access.
13. A page cannot change the destination allow-list or task limits.
14. The agent cannot click, submit, send, purchase, publish or run commands in read-only mode.

### Reliability and audit

15. Navigation timeout returns `TIMED_OUT`, not success.
16. Cancellation terminates the task and closes its context.
17. Browser crash is reported as failure and cleanup is attempted.
18. Audit events correlate to one task ID and contain no secrets.
19. Oversized page text is truncated or rejected according to policy.
20. Repeated test runs leave no persistent session profile or temporary user data.

## 9. Implementation sequence

1. Inspect the repository for existing browser/runtime libraries, agent gateway, policy, audit and test conventions. Reuse existing approved components where suitable; do not create a parallel authority service.
2. Select a browser automation dependency only after licence, maintenance, security and dependency review.
3. Implement URL policy and local fixture tests first.
4. Implement isolated session lifecycle and cleanup.
5. Implement read-only extraction and structured result schema.
6. Add audit events and timeout/cancellation handling.
7. Run all acceptance tests; document exact commands, versions and evidence.
8. Only after this POC is reviewed, propose form preparation, approvals, user memory and optional execution adapter as separate increments.

## 10. Exit criteria and handoff

The POC is complete when the acceptance tests pass, test evidence is attached to the implementation PR, and a reviewer confirms:

- no production data or accounts were used;
- no external spend occurred;
- browser isolation and destination restrictions are effective;
- no write/action tools are present in the POC capability registry;
- no secrets are present in source, test fixtures, logs or artifacts;
- the POC remains independent of AI Commander and any hosted relay.

**Current status:** specification only. No browser package has been installed, no browser process has been launched, no public website has been automated, and no runtime implementation or test result is claimed.
