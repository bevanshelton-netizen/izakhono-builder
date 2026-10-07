# IZAKHONO NODE01-SW

NODE01-SW is the software-defined foundation of the IZAKHONO node. It is designed to run on a laptop, workstation, VM, VPS, cloud host, or later on dedicated hardware without changing the control-plane API.

## Current v0.1 scope

- `/health` readiness endpoint
- `/api/v1/node` node identity/capability endpoint
- `/api/v1/workspaces` isolated workspace registry
- `/api/v1/jobs` lightweight job queue
- portable Node.js runtime
- Docker image and Compose deployment
- no arbitrary shell execution in the initial release

## Run directly

```bash
cd node01
npm start
```

Then check:

```bash
curl http://127.0.0.1:8940/health
```

## Run with Docker

```bash
cd node01
docker compose up -d --build
```

Then:

```bash
curl http://127.0.0.1:8940/health
```

## Design principle

NODE01-SW is a software-defined node, not a claim that software removes the need for compute. It removes dependence on one specific physical machine by making the node portable across available compute.

The next layers are policy-controlled runtime adapters, persistent queue/storage, authentication, observability, deployment orchestration, and the IZAKHONO CODE/RUN/DEPLOY/PROVISIONER integrations.
