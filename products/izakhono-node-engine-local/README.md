# IZAKHONO NODE ENGINE — Local prototype

This is a runnable proof-of-concept for **single-device self-hosting**. The computer running Node.js serves website files from its own disk and CPU. It is not a distributed node or remote deployment.

## Requirements and run

- Node.js 20 or newer; no external packages.
- From this directory run `npm start`.
- Website: `http://127.0.0.1:4321`.
- Owner control panel: `http://127.0.0.1:4322`.
- Stop the process with Ctrl+C.

Both listeners bind to loopback only. The control panel can start and stop the website host and display a system/controller-process snapshot. Control actions require a same-origin browser request. The panel is not exposed to the LAN or public internet.

## Tests

Run `npm test` with Node.js 20+. Tests cover static serving, lifecycle, path and method restrictions, resource admission policy, loopback control-plane behavior, same-origin action checks and dashboard headers.

## Resource governance status

The resource-policy module validates owner-defined budgets and conservatively blocks new workload admission when safety conditions apply. This is **admission control only**; it does not enforce hard CPU, memory or disk quotas. The dashboard's memory values describe the controller process and system snapshot, not an individual hosted workload. See [docs/RESOURCE-GOVERNANCE.md](docs/RESOURCE-GOVERNANCE.md).

## Current limitations

- Static files only; no arbitrary application runtime or database.
- No OS-enforced CPU/memory/disk quotas or process isolation.
- No per-workload CPU/RAM/network telemetry.
- No LAN/public publishing, relay, domain or TLS automation.
- No installer, background service, mobile build or production readiness.
- No external security review.

Do not expose this prototype to a public network. Keep both listeners on loopback. The project must implement and test platform-specific enforcement and security before managing arbitrary user workloads.

## Platform support boundaries

The platform detector reports Windows, macOS and Linux as prototype-runtime targets, Android as experimental runtime-only, and iOS as not supported by this Node.js prototype. These labels do not imply installers, background services, OS-enforced quotas, isolation or network publishing. See [docs/PLATFORM-CAPABILITY-MATRIX.md](docs/PLATFORM-CAPABILITY-MATRIX.md) for the capability matrix and implementation sequence.
