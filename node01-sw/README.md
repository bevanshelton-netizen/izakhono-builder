# IZAKHONO NODE01-SW — Computer Replacement Layer

NODE01-SW is the software-defined workstation/control plane for IZAKHONO. Its purpose is to remove dependence on a particular physical computer by making the user's **workspace, files, applications, AI, development environment and automation portable across available compute**.

It does not claim to eliminate the physical need for CPU, memory, storage or networking. Instead, it makes those resources interchangeable behind a stable software-defined computer identity.

## Target experience

```text
PHONE / TABLET / LAPTOP / BROWSER
                ↓
        IZAKHONO CLIENT
                ↓
         NODE01-SW SESSION
                │
 ┌──────────────┼─────────────────┐
 Files       Applications        AI
 Browser     Code/IDE             Jobs
 Workspace   Build/Run/Test       Communications
                │
          Compute Adapter
                │
     owned node / VM / VPS / cloud
```

## Core contracts

- session lifecycle
- persistent workspace
- virtual file-space
- application registry
- capability-based permissions
- job orchestration
- isolated execution boundary
- device heartbeat
- backup/snapshot contract
- compute-provider abstraction
- client/session continuity

The existing v0.2 API remains the control-plane foundation. Arbitrary host shell execution is intentionally not exposed over HTTP.

## Computer-replacement layers

### 1. Workspace
The user's state follows the user rather than a particular computer.

### 2. Applications
Applications are registered as portable workloads. The client requests a capability; NODE01 selects an available execution provider.

### 3. Files
Files live behind a virtual workspace abstraction so storage can move between local disk, owned storage, object storage or an approved fallback.

### 4. Compute
A provider adapter supplies CPU/RAM/GPU/containers. The NODE01 identity stays stable when compute changes.

### 5. AI
AI services become a first-class workspace capability rather than a separate application silo.

### 6. Continuity
A session can resume on another device without rebuilding the entire workstation.

## Security model

- authenticated sessions
- explicit capabilities
- isolated jobs
- deny-by-default privileged operations
- auditable job records
- no unrestricted remote shell
- separate user/data/entity boundaries
- encrypted secrets and credentials

## Roadmap

**v0.3 — Workstation API**
- session API
- workspace file API
- application registry
- provider selection
- snapshot/restore contracts

**v0.4 — Web Computer**
- browser desktop UI
- file manager
- app launcher
- terminal through a restricted job adapter
- live job status

**v0.5 — Portable Computer**
- multi-device sessions
- offline cache/sync
- encrypted personal vault
- compute failover
- local-first mode

**v1.0 — IZAKHONO Computer**
- complete cloud/local workstation experience
- AI-native interaction
- software-defined storage
- portable applications
- secure communications
- resilient compute routing

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
