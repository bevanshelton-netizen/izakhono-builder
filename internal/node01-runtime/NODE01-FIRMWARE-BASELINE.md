# Physical Execution Environment — Firmware Baseline

This checklist applies only when NODE01 software is executed on physical hardware. Firmware belongs to the machine, not to NODE01. Replacing the machine replaces its firmware baseline; it does not replace the NODE01 software identity.

Record firmware state for BMC/IPMI, BIOS/UEFI, storage controller, NVMe/SAS drives, production NICs and TPM where present.

## Security principles

- UEFI boot and Secure Boot where supported.
- TPM 2.0 enabled where available.
- BMC isolated to the management network.
- Administrative credentials stored outside Git.
- Firmware updates validated against the hardware vendor's supported matrix.
- Record versions, dates and diagnostics in the execution-environment commissioning record.

## Acceptance

Firmware is accepted only for the actual replacement environment after versions are recorded, security settings are applied, diagnostics are clean and controlled reboot succeeds. Do not label the firmware or physical asset as NODE01.
