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

The tests cover loopback start/stop, file delivery, GET/HEAD-only methods, missing files, directory-listing denial and the non-loopback opt-in guard.

## Current limitations

- Static files only; no user application runtime or database yet.
- No graphical control panel; this initial vertical slice uses a foreground CLI.
- No hard CPU/memory quotas yet.
- No LAN/public publishing, relay, domain or TLS automation.
- No installer, persistence, background service, mobile build or production readiness.
- Resource enforcement and OS lifecycle integration are future milestones.

Do not expose this prototype to a public network. The engine is development software and has not been security-reviewed or externally deployed.
