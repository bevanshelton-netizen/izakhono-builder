# IZAKHONO HOST — Supplier Evidence and Capability Comparison Engine v1

**Status:** Read-only decision-support tooling; no supplier selected or approved.  
**Scope:** Exact supplier SKU and workload role, not brand-level ranking.

## Decision model

1. Validate each local evaluation record against `supplier-evaluation.schema.json`.
2. Apply mandatory hard gates for the intended workload role.
3. Require every applicable gate to be marked `pass`, supported by `verified` evidence and a non-empty evidence reference. `supplier-claimed`, `unknown`, missing, and `fail` are blockers.
4. Only after every hard gate passes, calculate the 100-point weighted score using the assessment weights.
5. Rank complete, hard-gate-passing records deterministically by score, supplier ID and SKU.

The hard gates are not offset by a low price or a high weighted score. Mail, DNS-secondary and backup roles have additional role-specific gates. The purchase approval field is recorded but this tool always returns `purchasePermitted: false`.

## Weighted categories

| Category | Weight |
|---|---:|
| Technical fit and performance | 20 |
| Mail delivery suitability | 20 |
| Security and operational control | 15 |
| Resilience and recovery | 15 |
| Total cost and contract clarity | 15 |
| Portability and exit | 10 |
| Support and location fit | 5 |
| **Total** | **100** |

Each category is scored 0–5 and requires verified evidence plus a reference. Weighted points = raw score ÷ 5 × weight. A missing or supplier-claimed score makes the weighted result incomplete and unranked.

## Role-specific hard gates

All roles require: owner control, capacity, security, resilience, supplier transparency, exit capability and quote clarity.

- `mail`: written mail permission; inbound/outbound TCP 25; mail service ports; static IPv4; PTR/rDNS control; commercial multi-tenant mail permission.
- `dns-secondary`: distinct failure domain; UDP/TCP 53; authenticated AXFR/IXFR.
- `backup`: independent account; encryption; successful restore test.

## Run locally

```sh
python -m pip install 'jsonschema==4.23.0'
python platform/validate/supplier_evaluate.py --input-dir platform/validate/fixtures/suppliers
```

The included record is entirely synthetic and exists only to exercise scoring. It is not a real supplier, quote, resource, evidence set or recommendation.

## Output interpretation

- `BLOCKED_HARD_GATES`: not eligible; at least one required gate is missing, failed, unknown or not independently evidenced.
- `INCOMPLETE_WEIGHTED_EVIDENCE`: gates may pass, but one or more score categories lack verified evidence.
- `SCORED`: all gates and score categories are evidenced; score bands are a comparison aid only.
- `invalidRecords`: malformed records are reported and excluded, never silently scored.

Score bands after hard gates pass: 85–100 preferred pilot candidate; 70–84 reserve candidate; 50–69 weak candidate; below 50 reject for the assessed role. A pilot still requires separate explicit cost approval and a reviewed deployment plan.

## Safety and evidence boundaries

- Local JSON only; no network, provider API, supplier email or external contact.
- No secrets or provider credentials are read.
- No purchase, provisioning, host enrollment, deployment, DNS, firewall, mail-routing or production action is implemented.
- A public marketing statement or verbal answer is not independently verified evidence. Keep the source reference and evidence status explicit.
- Score one exact SKU per workload role. Do not blend separate SKUs, regions, billing terms or managed/unmanaged offers into one score.
- Quote disclosure completeness is reported separately; do not compare headline monthly amounts without term, upfront amount, renewal, VAT and currency.
- Supplier selection, pilot approval, purchase approval and production authorization remain separate decisions.
- NODE01 remains a logical software identity. Supplier capacity is represented separately and does not become NODE01.
