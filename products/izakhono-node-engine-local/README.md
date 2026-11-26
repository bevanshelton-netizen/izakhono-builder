# IZAKHONO NODE ENGINE — Local prototype

This is the first runnable proof-of-concept for **single-device self-hosting**. The computer running Node.js serves the site's files from its own disk and CPU. It is not a distributed node or remote deployment.

## Requirements

- Node.js 20 or newer
- No external packages

## Run locally

From this directory:

```sh
npm start
```

Open `http://127.0.0.1:4321`. Stop the host with Ctrl+C.

The prototype serves `site/` on loopback only. It does not open a LAN/public listener, modify a firewall, configure DNS, create TLS certificates, install a background service, or run automatically at boot.

## Tests

```sh
npm test
```

The test suite covers loopback start/stop, static file delivery, method restrictions, missing files, directory-listing denial, non-loopback opt-in protection and owner-controlled resource admission rules.

## Resource governance status

The resource-policy module validates owner-defined budgets and conservatively blocks new workload admission when safety conditions apply. This is **admission control only**; it does not enforce hard CPU, memory or disk quotas. See [RESOURCE-GOVERNANCE.md](docs/RESOURCE-GOVERNANCE.md).

## Current limitations

- Static files only; no user application runtime or database yet.
- No graphical control panel; this initial vertical slice uses a foreground CLI.
- No hard CPU/memory/disk quotas or OS process isolation yet.
- No LAN/public publishing, relay, domain or TLS automation.
- No installer, background service, mobile build or production readiness.
- Resource enforcement and OS lifecycle integration are future milestones.

Do not expose this prototype to a public network. The engine is development software and has not been security-reviewed or externally deployed.
