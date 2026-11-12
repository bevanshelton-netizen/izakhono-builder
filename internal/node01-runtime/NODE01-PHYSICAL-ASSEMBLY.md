# Execution Environment — Physical Assembly Reference

## Purpose

This is a vendor-neutral reference for assembling a physical execution environment that may run IZAKHONO NODE01 software. **NODE01 itself is software, not this appliance, machine or hardware.** This document does not claim that any physical assembly has occurred or that this is the currently active replacement environment.

## Reference hardware profile

- 2U enterprise rack server where rack hardware is selected
- 24–32 enterprise CPU cores sized to the workload
- 128 GB ECC memory baseline; 256 GB target
- Mirrored enterprise NVMe boot storage
- Redundant application/workload storage
- Separate backup failure domain
- Redundant production networking and isolated management interface
- TPM 2.0 and Secure Boot where supported
- Dual power supplies and protected power

## Physical acceptance

For a physical execution environment, verify management access, memory diagnostics, storage health, power paths, network links, firmware baseline and recovery procedures before binding it to NODE01.

## Identity and replacement

The physical asset must retain its own inventory identifier. The runtime-binding record maps the NODE01 software identity to the asset's actual verified locator. Replacing the asset changes that mapping only; it does not replace or rename NODE01.
