# IZAKHONO COMMANDER SECURITY

- Use only on owned or explicitly authorized machines.
- Put the server behind HTTPS and preferably a private VPN.
- COMMANDER_ADMIN_SECRET is server-side only and must never be committed.
- Pairing codes are one-use and expire after 10 minutes.
- Browser clients never receive agent tokens.
- Commands are named operations with fixed argument vectors; arbitrary shell strings are not accepted.
- Graphical sessions are short-lived, explicitly authorized, auditable, and automatically expired.
- Agent frame/input endpoints require the enrolled device token and active session binding.
- Stop closes the graphical session and clears the server-side input queue.
- Add rate limiting and device revocation before public exposure.
- Add a persistent database adapter before production; the current reference keeps state in memory.
- Do not add destructive filesystem/process operations without explicit authorization controls and audit coverage.
- Keep graphical transport behind HTTPS/WSS or a private VPN; do not expose plaintext production sessions.
