# IZAKHONO NODE01-SW

Portable software-defined NODE01 control/execution plane.

NODE01-SW is designed to replace dependence on one physical NODE01 machine. It can run on a workstation, VM, VPS, container host, or other available compute and expose the same stable node contract.

## Contract

- `GET /health`
- `GET /v1/node`
- `POST /v1/workspaces`
- `GET /v1/workspaces`
- `POST /v1/jobs`
- `GET /v1/jobs/:id`
- `GET /v1/capabilities`

The v0.2 control plane deliberately does **not** expose arbitrary shell execution over HTTP. Build/run adapters are represented as jobs and must be implemented behind an authenticated, isolated executor.

## Run

```bash
cd node01-sw
npm install
npm start
```

Default port: `8940`.

Set `NODE01_TOKEN` to require bearer authentication for `/v1/*` endpoints.

## Docker

```bash
docker compose up --build -d
```

Persistent state is stored in `/data`.

## Architecture

```text
NODE01-SW
  ├── Node Identity
  ├── Health / Capabilities
  ├── Workspace Registry
  ├── Job Queue
  ├── Build Broker
  ├── Run Broker (isolated adapter boundary)
  ├── Deploy Broker
  └── Provisioner Adapter Boundary
```

This makes NODE01 portable while keeping execution isolated and replaceable.
