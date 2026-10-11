# IZAKHONO NODE01 — Owned Compute Hardware Specification

## Design target
NODE01 is the first owned IZAKHONO compute node. It is designed to run production web applications, APIs, databases, automation and internal platform services without making an external hosting provider the primary dependency.

## Recommended production configuration

| Component | NODE01 specification |
|---|---|
| Form factor | 2U rack server, 1,000 mm cabinet depth |
| CPU | 1× current-generation server CPU, 24–32 physical cores target; platform must support a second CPU later |
| RAM | 128 GB ECC RDIMM minimum; 256 GB target; expandable to 512 GB+ |
| OS storage | 2× enterprise NVMe SSD, mirrored boot volume, 960 GB–1.92 TB each |
| Application storage | 4× enterprise NVMe/SAS SSD, 1.92–3.84 TB each; redundant storage pool |
| Backup storage | Separate storage appliance/node; never rely on NODE01's primary disks as the only backup |
| Network | 2× 10 GbE production interfaces + dedicated 1 GbE management interface |
| Management | BMC/IPMI/iDRAC/iLO-class out-of-band management |
| Security | TPM 2.0, Secure Boot capable, ECC memory |
| Power | Dual hot-swap PSUs |
| UPS | Online double-conversion UPS, sized for measured server + network load |
| Rack | 42U preferred; 1,000 mm deep; spare capacity for NODE02 and networking |
| Cooling | Dedicated controlled server-room cooling; temperature monitoring required |

## Why this design

The platform is deliberately balanced rather than buying the largest possible server. The initial workload is compute + application + automation heavy, while storage and redundancy are handled independently. The server must have enough PCIe, memory and drive expansion to grow without replacing the chassis.

A South African 2026 market reference places certified-refurbished rack servers around a R44k median and new servers much higher; therefore NODE01 should be sourced by specification and total cost of ownership rather than by brand alone. citeturn0search2

## Acceptable server families

The production design can be implemented on a current Dell PowerEdge, HPE ProLiant, Lenovo ThinkSystem or equivalent enterprise platform meeting the specification. Lenovo's current ThinkSystem range, for example, supports ECC RDIMM memory, NVMe storage and hardware-root-of-trust management. citeturn0search6turn0search7

## Storage topology

1. Mirrored NVMe boot pool.
2. Redundant application/data pool.
3. Private registry data stored on persistent storage.
4. Backups stored outside the primary storage failure domain.
5. Critical configuration and manifests remain version-controlled.
6. Every backup receives a SHA-256 manifest.

## Power architecture

NODE01 must be connected to an online UPS and protected power circuit. UPS sizing must include the server, network switch, router/firewall and management equipment. Online double-conversion is preferred for production compute because it provides zero-transfer protection for sensitive equipment. citeturn0search4turn0search8

## Growth path

NODE01 → NODE02 warm standby → NODE03/compute expansion → dedicated storage → GPU/AI node → multi-node IZAKHONO private cloud.

## Acceptance criteria

NODE01 is hardware-ready only when:

- ECC memory passes diagnostics.
- All storage devices pass health tests.
- RAID/storage redundancy is verified.
- BMC remote management works.
- Both production network links work.
- UPS communications work.
- Clean reboot/recovery succeeds.
- Thermal load test passes.
- Docker workload test passes.
- Backup and restore test passes.
