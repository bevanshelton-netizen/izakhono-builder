# Mandatory NODE01 identity instructions for AI agents and contributors

**NODE01 IS SOFTWARE. NODE01 IS NOT PHYSICAL INFRASTRUCTURE.**

Treat NODE01 only as IZAKHONO's stable logical software/runtime identity. Never describe it as a server, computer, machine, laptop, VM, hardware device, hostname, cloud instance, container host or network appliance.

The execution environment is separate and replaceable. Keep `logical_node_id: NODE01`, `identity_type: software-runtime`, `runtime_host` (separate environment locator only), and `runtime_host_is_separate: true` distinct.

This applies to code, APIs, configuration, infrastructure-as-code, CI/CD, installers, logs, telemetry, product copy, documentation and generated code. Run `python3 scripts/architecture/check-node01-identity.py` before accepting changes. Do not weaken the gate; correct conflicting definitions. Canonical policy: `architecture/NODE01-IDENTITY-STANDARD.md`.
