# IZAKHONO OS — Alpha

**Status:** source scaffold / buildable alpha. Not yet a verified production operating system.

IZAKHONO OS is an owner-controlled desktop operating-system programme focused on one goal: make a computer dramatically easier to operate without taking power away from advanced users.

## Core promise

A new user should be able to do nearly everything from six clear choices: Internet, My Files, Apps, Settings, Updates and Help Me. Advanced users retain the complete Linux desktop, terminal and system tools.

## Foundation

Alpha uses a Debian Linux base and KDE Plasma desktop components. IZAKHONO owns the product experience, configuration, Easy Center, privacy policy, release process and local platform engine. Upstream components retain their own licences and trademarks.

First hardware target: **64-bit PC (amd64)**.

## Non-negotiable privacy rule

**No tracking.** No behavioural analytics, advertising identifiers, silent telemetry, user profiling, tracking pixels, hidden background analytics, sale of user activity, or default crash-report uploads containing user data. Any networked feature must be explicit, necessary, visible and user-controlled.

See `PRIVACY.md`.

## Local platform engine

The Alpha includes a restricted local engine exposed only through a Unix-domain socket at `/run/izakhono-engine/engine.sock`. It has no TCP listener, no network access, no telemetry and no arbitrary shell-dispatch capability.

Allow-listed actions provide:
- Local system status
- Installed desktop-app catalogue metadata
- Privacy-policy status
- Read-only migration preview for standard user folders
- Local update-index status without network access or installation
- Help topic catalogue

The migration action only counts candidate files and bytes. It does not copy, delete, rename or modify source files. Actual migration execution remains disabled until conflict handling, destination checks, rollback and representative migration tests pass. Updates remain user-initiated. Privileged settings and arbitrary commands are not exposed through the engine.

## Alpha features

- Bootable Debian live-image recipe
- KDE Plasma desktop and IZAKHONO Easy Center
- Local privacy and migration centers
- Local allow-listed platform engine
- Firefox ESR with telemetry/studies disabled by policy
- Dolphin, Discover, Flatpak, NetworkManager and PipeWire
- Printing and firmware-update tooling
- LibreOffice, VLC and firewall tooling

## Build

On a supported Debian build node:

```bash
cd products/izakhono-os
sudo ./build.sh
```

Expected output: `live-image-amd64.hybrid.iso`. The ISO must pass VM boot verification before any physical-device install.

## Roadmap

- **Alpha 0.1:** bootable image, device checks and privacy verification.
- **Alpha 0.2:** graphical installer, disk-encryption option and recovery strategy.
- **Alpha 0.3:** migration execution only after safe-copy and rollback acceptance.
- **Alpha 0.4:** local plain-language help and safe allow-listed system actions.
- **Beta:** signed updates, restore points, Secure Boot plan, device certification, accessibility, localisation and enterprise administration.

## Non-claim

The product target is to outperform mainstream desktop operating systems on simplicity, transparency, recovery and owner control. The current alpha is not claimed to exceed Microsoft Windows in every technical area, and no ISO boot, installer or hardware acceptance is claimed until independently tested.
