# Execution Environment — South Africa Bill of Materials

This is a reference procurement baseline for a possible physical execution environment. It is not a bill of materials for NODE01 itself. **NODE01 is software; machines and hardware are replaceable execution infrastructure.** Obtain current quotations before procurement.

| Item | Reference quantity | Acceptance requirement |
|---|---:|---|
| Enterprise rack server | 1 | Sized to workload, ECC, redundant power |
| Server CPU | 1 | Current enterprise generation |
| ECC memory | 128 GB minimum | 256 GB preferred |
| Enterprise NVMe boot SSD | 2 | Mirrored |
| Enterprise data SSD | 4 | Redundant pool |
| Managed network switch | 1 | VLANs and required uplinks |
| Firewall/router | 1 | Segmentation, VPN, stateful firewall |
| Online UPS | 1 | Sized from measured load |
| Rack/PDU | As required | Protected power and airflow |
| Backup storage | 1 independent target | Separate failure domain |
| Cabling/sensors | As required | Rated for intended environment |

## Procurement and binding

Procurement is independent of NODE01 identity. Record the selected asset's actual inventory/locator in the runtime-binding record. Never call the purchased machine NODE01 or assign its hardware serial, hostname or IP as the logical software identity.

## Replacement rule

The former execution machine has been replaced. Procurement records for old hardware must not be treated as proof of the current active environment. The replacement's verified locator must be separately recorded before runtime binding is marked verified.
