# IZAKHONO CODE — DeepSeek Harness Sandbox

**Status:** Development evaluation only  
**Upstream:** `deepseek-ai/deepseek-harness`  
**Pinned evaluation version:** `@deepseek-ai/dsh@0.1.7-rc.2`

DeepSeek Harness is an MIT-licensed developer-preview coding agent. It is useful as a replaceable productivity tool, but its upstream safety guidance explicitly says it is not security-audited or production-ready and that it can execute model-generated commands and access resources made available to it.

## IZAKHONO rule

Harness is **not** part of the trusted production boundary.

Use it only in an isolated evaluation environment with:

- a disposable or recoverable machine/VM where practical;
- a dedicated `DSH_HOME`;
- a dedicated non-production workspace;
- no production credentials;
- no customer records;
- no FORTRESS intelligence;
- no unpublished proprietary repository mounted into the sandbox;
- no payment, DNS, cloud-admin or signing credentials;
- backups before any agent execution.

The launcher in this directory creates a dedicated workspace under the current Windows user's Local AppData rather than opening an IZAKHONO production repository.

## Start

Run:

`START-DEEPSEEK-HARNESS-SANDBOX.cmd`

The launcher requires Node.js compatible with the pinned Harness release and starts the Web UI on its loopback default. It does not inject any API key.

## Optional NVIDIA development model

In Harness **Settings → Models → Add model provider → Custom model API**, a development-only OpenAI-compatible provider can be configured with:

- Provider ID: `izakhono-nvidia-dev`
- Base URL: `https://integrate.api.nvidia.com/v1`
- Protocol: OpenAI Chat Completions
- Model: `nvidia/nemotron-3-ultra-550b-a55b`
- Credential: the NVIDIA development API key

Treat this route as external. Only public/non-sensitive test material may be sent to it. Do not paste private source, credentials or customer information.

## Promotion gate

No Harness-based workflow may be promoted into IZAKHONO production until:

1. the exact upstream version is reviewed and pinned;
2. the plugin/dependency inventory is reviewed;
3. the execution environment is strongly isolated;
4. credentials are least-privilege and scoped;
5. destructive commands require explicit approval;
6. backups/rollback are proven;
7. outbound network access is allowlisted;
8. the workflow passes IZAKHONO's own tests independently of Harness.

Harness remains replaceable. IZAKHONO CODE, SUPER AI, Runtime Fabric and the authoritative repositories must continue to work without it.
