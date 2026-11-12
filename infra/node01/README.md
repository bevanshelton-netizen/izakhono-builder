# NODE01 Software Runtime — IZAKHONO NAV

NODE01 is the stable software/runtime identity that governs the NAV release. It is not the server, machine, VM, VPS, cloud instance or physical asset executing the software.

The previous execution machine has been replaced. The replacement is a separate execution environment. Keep its actual locator in the runtime binding and preserve `logical_node_id: NODE01`.

## NAV deployment

Use the approved deployment workflow for the selected execution environment. Verify the target binding, immutable release, runtime health, workload health, backup/restore and rollback before promotion.

The deployment must not infer that a machine is NODE01 from its hostname or hardware identity. Public availability requires separate DNS/TLS/HTTPS verification. Repository files or CI success alone do not prove a live runtime.
