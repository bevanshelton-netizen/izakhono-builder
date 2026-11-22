# IZAKHONO CODE AGENT

Provider-neutral coding-agent foundation for IZAKHONO BUILDER.

## v1 scope

This module establishes the coding-agent contract and safety boundary:

- deterministic inspect → edit → test → review task plan
- explicit repository and base-ref binding
- isolated workspace requirement
- path traversal and absolute-path rejection
- executable allowlisting and command timeouts
- patch-size limits
- network policy enforcement
- evidence returned by the workspace runner

## Runtime boundary

This package does **not** execute shell commands or access the host filesystem. A separately managed isolated runner must implement `CodeRunner`. The runner is responsible for creating and destroying workspaces, enforcing filesystem containment, process isolation, resource limits, secret isolation, network policy and output limits.

The agent must never treat NODE01 as a physical host. Workspace runners are replaceable execution substrates and must be explicitly registered and authorised.

## Current limitations

This is the first coding-agent foundation, not a completed Codex-equivalent product. It does not yet include a production runner, model-driven patch author, durable workspace/session storage, Git branch/commit/PR adapter, UI, or deployment integration. Those capabilities must be implemented and verified independently before the product is described as operational.

## Test

```bash
npx --yes tsx@4.20.3 products/izakhono-code-agent/src/index.test.ts
```
