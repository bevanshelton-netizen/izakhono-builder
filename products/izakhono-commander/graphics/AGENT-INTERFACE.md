# Native graphics agent contract

The agent process on the authorized computer is responsible for OS-level graphics.

Required adapters:

### Windows
Use Windows Desktop Duplication / Windows Graphics Capture for frames and SendInput for mouse/keyboard.

### macOS
Use ScreenCaptureKit for frames and Quartz CGEvent for input. macOS requires the user to grant Screen Recording and Accessibility permissions.

### Linux
Use PipeWire/Wayland or X11 capture depending on the session and libinput/uinput-compatible input control with explicit local permissions.

The agent must expose these operations only after a valid short-lived graphics session is authenticated.

The local machine must show a persistent “IZAKHONO COMMANDER — remote session active” indicator and provide a local stop control.

The server should never receive raw desktop credentials and should never execute an arbitrary shell command as part of screen/input control.
