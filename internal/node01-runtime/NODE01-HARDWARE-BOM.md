# NODE01 Hardware BOM

## Compute appliance
| Component | Target |
|---|---|
| Chassis | 2U enterprise rack server |
| CPU | 24–32 physical cores, server/enterprise grade |
| RAM | 128 GB ECC minimum; 256 GB target |
| Boot storage | 2 × enterprise NVMe, mirrored |
| Workload storage | 4 × enterprise NVMe/SAS SSD, redundant |
| Production networking | 2 × 10 GbE |
| Management | Dedicated BMC/IPMI-class interface |
| Security | TPM 2.0 + Secure Boot capable |
| Power | Dual hot-swap PSU |

## Facility and resilience
- Online UPS sized for controlled shutdown/runtime margin.
- Rack PDU with documented power paths.
- Separate backup storage failure domain.
- Rack cooling/airflow appropriate for sustained server load.
- Spare enterprise drive(s) and documented replacement procedure.
- Console/KVM access path for recovery.

## Procurement acceptance
Exact vendor/model selection is intentionally deferred until procurement. Any selected component must satisfy the architecture and commissioning checklist. Commodity substitutions that weaken ECC memory, storage redundancy, management isolation, power redundancy or network capacity are not accepted as NODE01 production hardware.
