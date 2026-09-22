# IZAKHONO OS — Alpha

**Status:** source scaffold / buildable alpha. Not yet a verified production operating system.

IZAKHONO OS is an owner-controlled desktop operating-system programme focused on one goal: make a computer dramatically easier to operate without taking power away from advanced users.

## Core promise

A new user should be able to do nearly everything from six large choices:

1. **Internet**
2. **My Files**
3. **Apps**
4. **Settings**
5. **Updates**
6. **Help Me**

Advanced users still retain the complete Linux desktop, terminal and system tools.

## Foundation

Alpha uses a Debian Linux base and KDE Plasma desktop components. IZAKHONO owns the product experience, configuration, Easy Center, privacy policy, release process and future AI action layer. Upstream components retain their own licences and trademarks.

First hardware target: **64-bit PC (amd64)**.

## Non-negotiable privacy rule

**No tracking.**

IZAKHONO OS must not include:
- behavioural analytics
- advertising identifiers
- silent telemetry
- user profiling
- tracking pixels
- hidden background analytics
- sale of user activity
- default crash-report uploads containing user data

Any networked feature must be explicit, necessary, visible and user-controlled.

See `PRIVACY.md`.

## Alpha features

- Bootable Debian live-image recipe
- KDE Plasma desktop
- IZAKHONO Easy Center
- Firefox ESR with telemetry/studies disabled by policy
- Dolphin file manager
- Discover software centre
- Flatpak support
- NetworkManager
- PipeWire audio
- Printing support
- Firmware-update tooling
- LibreOffice
- VLC
- Firewall tooling

## Build

On a supported Debian build node:

```bash
cd products/izakhono-os
sudo ./build.sh
```

Expected output:

```text
live-image-amd64.hybrid.iso
```

The ISO must pass VM boot verification before any physical-device install.

## Roadmap

### Alpha 0.1 — bootable
- Build live ISO
- Verify keyboard, mouse, display, network, audio and Easy Center
- Verify privacy defaults
- Verify no IZAKHONO telemetry endpoints exist

### Alpha 0.2 — installable
- Branded graphical installer
- Disk-encryption option
- Recovery strategy
- Hardware preflight before destructive disk actions

### Alpha 0.3 — migration
- Windows-data migration assistant
- Browser and document import
- Printer/peripheral verification
- Windows-app compatibility catalogue where legally and technically appropriate

### Alpha 0.4 — Ask IZAKHONO
- Plain-language local help
- Safe allow-listed system actions
- Exact change preview before privileged actions
- No arbitrary shell execution from natural language

### Beta
- Signed updates
- Secure Boot plan
- Automated restore points
- Device certification matrix
- Accessibility and multilingual onboarding
- Enterprise administration

## Non-claim

The product target is to outperform mainstream desktop operating systems on simplicity, transparency, recovery and owner control. The current alpha is not claimed to exceed Microsoft Windows in every technical area.
