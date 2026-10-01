# IZAKHONO COMMANDER GRAPHICS TRANSPORT

## Purpose

Defines the authenticated session protocol between the browser console, COMMANDER control plane, and an explicitly paired desktop agent.

## Session lifecycle

1. Operator authenticates to COMMANDER.
2. COMMANDER creates a short-lived graphics session bound to one enrolled device.
3. Browser opens WSS using the short-lived session credential.
4. Agent connects using its device credential and receives only sessions explicitly bound to that device.
5. COMMANDER relays signalling and session messages; it does not execute browser-supplied commands.
6. Agent sends screen frames only while the session is active.
7. Browser sends normalized pointer/keyboard events only while the session is active.
8. Either side may close the session; expiry and inactivity close it automatically.

## Message classes

- `hello`: authenticated endpoint identity.
- `display_list`: available displays and dimensions.
- `frame`: encoded screen frame payload.
- `input`: normalized pointer, button, wheel, or keyboard event.
- `ready`: graphical channel ready.
- `close`: terminate the session.
- `error`: non-sensitive protocol error.

## Safety constraints

- No arbitrary shell or process execution is part of this protocol.
- Clipboard and file transfer are separate capabilities and disabled by default.
- Input is accepted only from the currently authenticated session.
- Sessions are short-lived and inactivity-limited.
- Local agent must expose an active-session indicator and a local stop mechanism.
