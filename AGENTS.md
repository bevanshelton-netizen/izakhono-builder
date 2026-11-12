# Mandatory NODE01 identity instructions for AI agents and contributors

**NODE01 IS SOFTWARE. NODE01 IS NOT PHYSICAL INFRASTRUCTURE.**

Treat NODE01 only as IZAKHONO's stable logical software/runtime identity. Never describe it as a server, computer, machine, laptop, VM, hardware device, hostname, cloud instance, container host or network appliance.

The execution environment is separate and replaceable. Keep `logical_node_id: NODE01`, `identity_type: software-runtime`, `runtime_host` (separate environment locator only), and `runtime_host_is_separate: true` distinct.

This applies to code, APIs, configuration, infrastructure-as-code, CI/CD, installers, logs, telemetry, product copy, documentation and generated code. Run `python3 scripts/architecture/check-node01-identity.py` before accepting changes. Do not weaken the gate; correct conflicting definitions. Canonical policy: `architecture/NODE01-IDENTITY-STANDARD.md`.


## NODE01 machine-replacement continuity — mandatory

- NODE01 is the stable IZAKHONO software/runtime identity. It is not a machine, server, VM, hostname, cloud instance or hardware asset.
- The former execution machine has been replaced. The replacement is a separate, replaceable execution environment running the same NODE01 software identity.
- Preserve `logical_node_id: NODE01` and `identity_type: software-runtime` across machine replacement.
- Update only the separate runtime binding to the replacement's verified locator. Never derive NODE01 identity from machine-id, hostname, IP address, serial number or provider instance ID.
- Never carry forward the old machine locator as the current binding. Never invent the replacement locator.
- If the replacement locator or runtime acceptance is not verified, keep the binding unverified and deployment promotion blocked.
