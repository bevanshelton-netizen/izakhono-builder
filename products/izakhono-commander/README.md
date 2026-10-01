# IZAKHONO COMMANDER

Owned-first remote computer control plane for IZAKHONO HOST.

Features: secure device pairing, operator authentication, device health, allow-listed commands, root-scoped filesystem inspection, audit logging, and a browser dashboard. This v0.1 deliberately avoids arbitrary shell execution and pixel-stream remote desktop. A later display module can use RDP/VNC/WebRTC behind the same control plane.

Use only on computers IZAKHONO owns or is explicitly authorized to administer. Production deployment requires HTTPS, a secret manager, rate limiting, device revocation, and a private network/VPN where possible.

## Components
- server/: control-plane API
- agent/: local agent
- public/: operator dashboard
- schema/: persistence schema
- SECURITY.md: security rules

## Pairing
Start the server with COMMANDER_ADMIN_SECRET. Open the dashboard, generate a one-time pairing code, then run the agent with COMMANDER_SERVER and COMMANDER_PAIRING_CODE. The agent receives a device token and sends heartbeats.
