# IZAKHONO COMMANDER SECURITY

- Use only on owned or explicitly authorized machines.
- Put the server behind HTTPS and preferably a private VPN.
- COMMANDER_ADMIN_SECRET is server-side only and must never be committed.
- Pairing codes are one-use and expire after 10 minutes.
- Browser clients never receive agent tokens.
- Commands are named operations with fixed argument vectors; arbitrary shell strings are not accepted.
- Add rate limiting and device revocation before public exposure.
- Add a persistent database adapter before production; the v0.1 reference keeps state in memory.
- Do not add destructive filesystem/process operations without explicit authorization controls and audit coverage.
- A future screen-sharing module must authenticate through the same control plane and use encrypted transport.
