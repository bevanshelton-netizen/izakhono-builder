# IZAKHONO COMMANDER NATIVE GRAPHICS AGENT

Version: 0.2.1

This is the native OS-side component for graphical remote control.

It uses XCap for monitor capture and Enigo for cross-platform mouse/keyboard control. Enigo supports Windows, macOS and Linux, with Wayland/libei support requiring the relevant features and platform permissions.

The agent deliberately does not open an unauthenticated desktop listener. Production transport passes through an authenticated short-lived graphics session from COMMANDER.

## Environment
- COMMANDER_SERVER
- COMMANDER_DEVICE_ID
- COMMANDER_AGENT_TOKEN
- COMMANDER_FRAME_MS (optional)

## Permissions
Windows/macOS/Linux desktop security controls must be granted explicitly. macOS requires the appropriate Screen Recording and Accessibility permissions for capture/input. Linux Wayland environments require the appropriate portal/PipeWire/libei path.

## Verification
The repository workflow runs formatting and Cargo compilation checks on Ubuntu, Windows and macOS.