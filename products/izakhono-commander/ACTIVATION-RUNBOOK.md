# IZAKHONO COMMANDER ACTIVATION

## Server
Set a strong COMMANDER_ADMIN_SECRET and COMMANDER_PORT. Run the server on an HTTPS-capable host or behind a reverse proxy/VPN.

## Agent
On an authorized computer set COMMANDER_SERVER, COMMANDER_PAIRING_CODE and optional COMMANDER_DEVICE_NAME, then run the agent. The pairing code is generated in the dashboard, is single-use, and expires after ten minutes.

## Production gates
1. HTTPS/private network verified.
2. Persistent database adapter enabled.
3. Rate limiting enabled.
4. Device revoke/rotate workflow enabled.
5. Audit retention configured.
6. Backup and recovery tested.
7. Only then enable broader filesystem/process operations.

## IZAKHONO HOST integration
The Commander control plane is intended to become the operator-side remote administration layer for IZAKHONO HOST. It does not replace customer authentication, billing, DNS, registrar, or mail-provider controls.
