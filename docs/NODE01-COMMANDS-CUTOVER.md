# IZAKHONO COMMANDS — NODE01 cutover

## Goal

NODE01 is the preferred Command Centre gateway. The internal runtime remains authoritative; Supabase Edge is only the resilience path.

## One-click start

### Windows / owner machine

Run:

`RUN-IZAKHONO-NODE01-COMMANDS.cmd`

A PASS means the owned gateway is available locally at:

`http://127.0.0.1:8091/commands`

### Linux NODE01

Run:

`bash internal/node01-command-gateway/deploy-node01.sh`

## Architecture

```
Internet
  |
Owned DNS / TLS
  |
IZAKHONO EDGE
  |
NODE01 :8091
  |-- local IZAKHONO command runtime first
  \-- Supabase resilience only when local runtime is unavailable
```

## Public routing

Preferred dedicated hostname:

`commands.izakhono.co.za -> NODE01 EDGE/TLS -> 127.0.0.1:8091`

If the existing `ai.izakhono.co.za` reverse proxy is already on NODE01, route only:

- `/commands`
- `/commands/*`
- `/api/commands`
- `/api/commands/*`

to port 8091, while preserving the existing handler for all other paths.

The checked-in `internal/node01-command-gateway/Caddyfile.snippet` shows the routing shape.

## Verification

Windows:

`VERIFY-IZAKHONO-NODE01-COMMANDS.cmd`

Linux:

```bash
curl -fsS http://127.0.0.1:8091/healthz
curl -fsSI http://127.0.0.1:8091/commands
```

Do not call the public hostname live until TLS and public reachability are independently verified.
