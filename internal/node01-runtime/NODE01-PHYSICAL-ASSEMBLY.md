# NODE01 Physical Assembly Specification

## Purpose
Vendor-neutral physical build specification for the first IZAKHONO-owned NODE01 appliance. This document defines the target appliance; it does not claim physical assembly has occurred.

## Reference architecture
- Form factor: 2U enterprise rack server
- CPU: 24–32 physical cores, enterprise/server grade
- Memory: 128 GB ECC minimum; 256 GB target; expansion path to 512 GB
- Boot: 2 × enterprise NVMe, mirrored
- Workload storage: 4 × enterprise NVMe or SAS SSD, redundant storage pool
- Backup: separate physical failure domain; never the same storage pool as production
- Network: 2 × 10 GbE production plus dedicated management/BMC interface
- Management: BMC/IPMI-class out-of-band management
- Security: TPM 2.0, Secure Boot, UEFI
- Power: dual hot-swap PSU
- Facility: online UPS, rack PDU, controlled cooling and airflow

## Assembly order
1. Rack and electrically bond the chassis according to facility requirements.
2. Install CPU(s), ECC memory and cooling solution using vendor torque/thermal procedures.
3. Install mirrored boot devices in the designated boot slots.
4. Install four workload devices in the designated redundant storage slots.
5. Install production NICs and verify dedicated management interface.
6. Connect both PSUs to independent UPS/PDU feeds where available.
7. Connect BMC/management network separately from production traffic.
8. Label every power, management, production and storage connection.
9. Record chassis serial, motherboard serial, drive serials, NIC identifiers and firmware versions.

## Physical acceptance gate
Do not proceed to production software commissioning until:
- BMC is reachable and credentials are controlled outside Git.
- All installed memory passes POST and diagnostics.
- All storage devices are detected and healthy.
- Both PSU paths are operational.
- UPS and PDU paths are verified.
- Production and management links negotiate at expected speeds.
- Hardware diagnostics complete without critical faults.
- Firmware baseline is recorded.

## Non-negotiables
- No secrets in the repository.
- No single production disk failure may destroy the node.
- Backup storage must be independently recoverable.
- Management traffic must remain separated from workload traffic.
- Physical acceptance is a prerequisite for declaring NODE01 production-ready.
