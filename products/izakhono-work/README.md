# IZAKHONO WORK

Owner-controlled AI workspace for the first IZAKHONO node.

## Purpose

IZAKHONO WORK removes a **vendor usage-credit gate** from the owner's day-to-day workspace by running the language model on owner-controlled compute. It does **not** claim infinite compute: response speed, concurrency and model size are limited by the laptop/server hardware, storage, electricity and network.

The current owner release includes:

- mobile-friendly black, gold and green chat workspace
- local Ollama model runtime
- persistent SQLite conversation history on the owner node
- local text/code file attachments
- optional bearer-token support for later authenticated routing
- no payment, subscription or per-message credit logic
- no dependency on OpenAI for inference
- local-only host exposure by default

## Windows dedicated laptop

The Windows installer is the shortest owner-host path. It keeps both the AI runtime and workspace on the laptop and creates an **IZAKHONO WORK** desktop shortcut.

Prerequisites: Docker Desktop installed and its engine running.

From an Administrator PowerShell opened in the checked-out IZAKHONO BUILDER repository:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
& .\products\izakhono-work\install-windows.ps1
```

The installer automatically selects `qwen3:8b` when the machine reports at least 24 GB RAM; otherwise it uses `qwen3:4b`. A specific model can be selected explicitly:

```powershell
& .\products\izakhono-work\install-windows.ps1 -Model "qwen3:8b"
```

The application is exposed only to `127.0.0.1:9393`. Ollama is exposed only to `127.0.0.1:11434`. Docker volumes retain conversations and downloaded model data across container restarts.

## Linux owner host

From a checked-out IZAKHONO BUILDER repository:

```bash
sudo bash products/izakhono-work/install.sh
```

Default model: `qwen3:4b`. To select a larger model:

```bash
sudo IZAKHONO_WORK_MODEL=qwen3:8b bash products/izakhono-work/install.sh
```

The Linux service is also bound to localhost. New local-only installations leave the application bearer token blank so the owner is not forced to retrieve and paste a secret merely to use a service that cannot accept non-local connections.

## Security boundary

This release is deliberately **local-only**. Do not bind port 9393 directly to the public internet. Remote phone/tablet access should be added through the IZAKHONO edge/access layer with TLS, authenticated routing and an explicit owner-device trust boundary.

The application still supports `IZAKHONO_WORK_TOKEN` when a bearer-token boundary is needed, but the localhost owner experience does not require one.

## Capacity

There is no artificial message quota in the application. Model throughput depends on the hardware. A smaller model can make an ordinary laptop responsive; a GPU owner node can later run larger models and serve more simultaneous users.

“Unlimited access” therefore means **no vendor message-credit counter inside IZAKHONO WORK**. It does not mean infinite CPU, GPU, RAM, storage, electricity or bandwidth.


## BUILD mode

IZAKHONO WORK now includes a local software-building mode. BUILD gives the local model a restricted project workspace under the owner's IZAKHONO WORK data directory.

BUILD can:
- create project folders and text/code files
- inspect only the current project tree
- read files inside the project
- create before/after checkpoints
- validate JSON and Python syntax, and JavaScript syntax when Node is available
- preview projects that contain an `index.html`
- export a project as a ZIP

BUILD does **not** expose an unrestricted shell to the model. Generated code is not automatically executed. This keeps the default owner-node boundary materially safer while still letting the model create complete dependency-light applications.

The first builder release deliberately favors standalone HTML/CSS/JavaScript and Python-standard-library projects. More powerful package installation, test execution and deployment capabilities should be added as explicit, auditable permissions rather than silently granting arbitrary host execution.

## Builder activation on the existing owner laptop

Re-run the owner-node takeover after this release is merged. The takeover refreshes both `app.py` and `builder_core.py`, preserves the existing local model/data, restarts IZAKHONO WORK, verifies local chat, restores Windows autostart, and opens the workspace.

The upgraded UI exposes two modes:

- **CHAT** — local assistant conversations.
- **BUILD** — owner-controlled software creation with project checkpoints, validation, preview and ZIP export.
