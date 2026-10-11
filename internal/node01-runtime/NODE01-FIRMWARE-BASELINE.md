# NODE01 Firmware Baseline

Before OS installation, record and standardize the firmware state for:

1. BMC/IPMI controller
2. System BIOS/UEFI
3. CPU microcode exposure as managed by the supported OS/vendor baseline
4. Storage controller or HBA
5. NVMe/SAS drives
6. Production NICs
7. TPM 2.0 firmware/state where exposed

## Required configuration principles
- UEFI boot mode.
- Secure Boot enabled for the production baseline.
- TPM 2.0 enabled.
- Virtualization extensions enabled where required by future workloads.
- Unneeded boot devices and external boot paths disabled.
- BMC exposed only to the management network.
- Administrative BMC credentials stored outside Git.
- Firmware versions and update dates recorded in the commissioning record.

## Update rule
Firmware updates must be validated against the selected hardware vendor's supported matrix before installation. Do not apply unverified firmware in production merely because a newer version exists.

## Acceptance
Firmware is green only when versions are recorded, security settings are applied, diagnostics are clean and the node can complete a controlled reboot into the intended UEFI/OS configuration.
