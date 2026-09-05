# IZAKHONO WORK

Owner-controlled AI workspace for the first IZAKHONO node.

## Purpose

This product removes a **vendor usage-credit gate** from the owner's day-to-day workspace by running the language model on owner-controlled compute. It does **not** claim infinite compute: response speed, concurrency and model size are limited by the laptop/server hardware, storage, electricity and network.

The first release includes:

- mobile-friendly chat workspace
- local Ollama model runtime
- persistent SQLite conversation history on the owner node
- local text/code file attachments (read in the browser and sent with the prompt)
- optional owner bearer token
- no payment, subscription or per-message credit logic
- no dependency on OpenAI for inference
- local-only binding by default (`127.0.0.1:9393`)

## Install on the dedicated owner host

From a checked-out IZAKHONO BUILDER repository on the Linux owner host:

```bash
sudo bash products/izakhono-work/install.sh
```

Default model: `qwen3:4b`.

To select a larger model before first install:

```bash
sudo IZAKHONO_WORK_MODEL=qwen3:8b bash products/izakhono-work/install.sh
```

The installer creates `/etc/izakhono/work.env` once and never prints the owner token. The local workspace is available at `http://127.0.0.1:9393` after the health gate passes.

## Security boundary

The first release is deliberately local-only. Do not bind it directly to the public internet. Remote phone access should be added through the IZAKHONO edge/access layer with TLS and authenticated routing, not by exposing port 9393.

The Ollama model runtime is also bound to localhost only at `127.0.0.1:11434`.

## Capacity

There is no artificial message quota in the application. Model throughput depends on the hardware. A smaller model can make an ordinary laptop responsive; a GPU owner node can later run larger models and serve more simultaneous users.
