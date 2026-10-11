# NODE01 — South Africa Build Bill of Materials

This is the procurement baseline, not a vendor quotation. Prices must be re-quoted before purchase.

| Item | Target quantity | Acceptance requirement |
|---|---:|---|
| Enterprise 2U rack server chassis | 1 | ECC, BMC, dual PSU, hot-swap capable |
| Server CPU | 1 | 24–32 physical cores; current server generation |
| ECC RDIMM | 128 GB minimum | 256 GB preferred |
| Enterprise NVMe boot SSD | 2 | Mirrored, enterprise endurance |
| Enterprise data SSD | 4 | 1.92–3.84 TB each, redundant pool |
| 10 GbE NIC | 2 ports minimum | Independent production links |
| Managed network switch | 1 | 10 GbE uplinks, VLAN support |
| Firewall/router | 1 | VLANs, VPN, stateful firewall |
| Online UPS | 1 | Sized from measured load; network management preferred |
| 42U rack cabinet | 1 | 1,000 mm depth, adequate airflow |
| Rack PDU | 2 | Separate A/B power paths where possible |
| Temperature sensors | 2+ | Rack inlet + exhaust/room |
| Backup NAS/storage node | 1 | Independent failure domain, snapshot support |
| Backup drives | As required | Enterprise/NAS-rated, sized for retention policy |
| Cat6A/fibre cabling | As required | 10 GbE capable |

## Procurement rule

Do not buy based on chassis name alone. Every quotation must be checked against `NODE01-HARDWARE-SPEC.md`, warranty, drive health, firmware support, power draw and expansion capacity.

## Recommended acquisition strategy

**Phase 1 — NODE01:** compute server + mirrored boot + redundant application storage + UPS + network.

**Phase 2 — Backup:** independent storage node + backup media + off-site copy.

**Phase 3 — NODE02:** second compute server matching or exceeding NODE01's workload compatibility.

**Phase 4 — Expansion:** additional compute/storage/GPU nodes as utilization requires.

## Budgeting

Current South African market references indicate certified-refurbished enterprise rack servers can be substantially cheaper than new systems, while new enterprise configurations carry a much wider price range. Use those figures only for budgeting and obtain firm quotations for the exact specification before purchase.
