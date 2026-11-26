# IZAKHONO HOST validation foundation

This directory contains read-only validation and planning tools for service manifests and execution-host inventory.

## Contents

- `schemas/service-definition.schema.json` — strict JSON Schema Draft 2020-12 contract for service definitions.
- `schemas/execution-host-inventory.schema.json` — strict contract for separately inventoried execution hosts.
- `policies/hosting-policy.v1.json` — baseline registry, security, production-approval and public-ingress policy.
- `fixtures/services/` and `fixtures/hosts/` — synthetic, non-deployable test records.
- `validate.py` — schema and policy validator; reads JSON only and makes no network or infrastructure changes.
- `inventory_plan.py` — deterministic read-only placement planner. It compares declared service demand with explicitly approved inventory records.
- `schemas/provider-readonly-discovery.schema.json` — normalized supplier capability/resource response contract with explicit evidence quality.
- `provider_discovery.py` — read-only adapter protocol and offline fixture adapter; no live provider client or mutation method is implemented.
- `fixtures/providers/` — synthetic discovery response; all unknown mail, networking and availability facts remain unknown.
- `schemas/supplier-evaluation.schema.json` and `supplier_evaluate.py` — exact-SKU, role-specific hard-gate evaluation and evidence-backed weighted comparison.
- `fixtures/suppliers/` — synthetic-only scoring example; not a real supplier or recommendation.
- `schemas/supplier-evidence-event.schema.json` and `supplier_evidence_ledger.py` — append-only local evidence intake with SHA-256 hash-chain verification.
- `fixtures/supplier-evidence/` — synthetic pending supplier claim; no real supplier evidence is included.
- `tests/` — regression tests for validation and planning policy.

## Run locally

Python 3.12 is used in CI. Install the pinned validation dependency and run:

```sh
python -m pip install 'jsonschema==4.23.0'
python platform/validate/validate.py
python -m unittest discover -s platform/validate/tests -v
python platform/validate/inventory_plan.py --service platform/validate/fixtures/services/caddy-staging.json --host-dir platform/validate/fixtures/hosts --environment staging --role staging-app
python platform/validate/supplier_evaluate.py --input-dir platform/validate/fixtures/suppliers
python platform/validate/supplier_evidence_ledger.py verify --ledger platform/validate/fixtures/supplier-evidence/synthetic-ledger.jsonl
python scripts/architecture/check-node01-identity.py
```

To test production approval policy without deploying anything:

```sh
python platform/validate/validate.py --environment production
```

The production-mode command is expected to reject the staging fixture because it has no production change-approval reference. That is an intentional fail-closed policy test.

## Generate a read-only placement plan

```sh
python platform/validate/inventory_plan.py \
  --service platform/validate/fixtures/services/caddy-staging.json \
  --host-dir platform/validate/fixtures/hosts \
  --environment staging \
  --role staging-app \
  --format json
```

The supplied host fixture is deliberately unverified, so the planner example must return `BLOCKED_NO_ELIGIBLE_HOST` (exit code 3). A `PLAN_READY` result requires an inventory record that passes schema and host policy checks, is approved for the requested environment and role, has a separately identified execution resource, supported OS, evidence and approval references, and sufficient declared schedulable capacity.

The planner multiplies CPU and memory by replica count and sums persistent storage mounts. Inventory capacity is interpreted as schedulable capacity, not gross physical capacity. Keep those values current and do not claim already-allocated resources as available. Selection is deterministic by host ID; it is not a live utilisation-aware scheduler.

## Provider discovery contract

The provider adapter protocol exposes only `discover_capabilities()` and `list_resources()`. The offline `FixtureProviderAdapter` reads a local synthetic JSON fixture and makes no network calls. Future live adapters must use provider-enforced read-only credentials, bounded request timeouts, explicit pagination/rate-limit handling and auditable source references. Do not implement create, resize, delete, reboot, DNS, firewall, shell or mail-routing operations in this discovery layer.

Every capability uses an evidence status: `verified`, `supplier-claimed`, `unknown`, or `not-applicable`. Unknown values remain null; supplier claims are not promoted to verified. In particular, TCP 25, reverse DNS/PTR, static IPv4 and commercial self-hosted multi-tenant mail permission remain unknown until supported by evidence. A resource state of `available` is only a provider-reported observation and does not reserve capacity or approve a host for deployment.

## Supplier comparison

Run the supplier evaluator against a directory containing one JSON evaluation per exact SKU. It applies mandatory role-specific gates before scoring and requires verified evidence references for every gate and weighted category. Supplier-claimed or unknown evidence blocks eligibility or ranking. The weights are technical fit 20, mail suitability 20, security/control 15, resilience/recovery 15, cost/contract clarity 15, portability/exit 10, and support/location 5. Mail, DNS-secondary and backup roles have additional hard gates. The result always records `purchasePermitted: false`; no aggregate score authorizes a pilot, purchase or deployment. See `docs/architecture/IZAKHONO-HOST-SUPPLIER-EVIDENCE-COMPARISON-ENGINE-V1.md` for the decision model.

## Supplier evidence intake

Use `supplier_evidence_ledger.py append --ledger /secure/path/evidence.jsonl --event /secure/path/event.json` to append a reviewed local event, and `verify --ledger /secure/path/evidence.jsonl` to validate the chain. The tool does not fetch URLs or store source documents. Keep contracts, private emails and source artifacts outside the repository in access-controlled storage. A supplier assertion remains pending until independently reviewed. See `docs/architecture/IZAKHONO-HOST-SUPPLIER-EVIDENCE-INTAKE-AUDIT-V1.md`.

## Safety properties

- No provider credentials, deployment credentials or secrets are read.
- No provider API, host, network endpoint or shell command is invoked.
- No provisioning, deployment, DNS, firewall, mail-routing or production action exists in these tools.
- The sample execution-host record is explicitly `unverified` and has no supplier resource ID or locator.
- The plan always declares `executionPermitted: false`, `deploymentPerformed: false`, and an empty action list. A plan is not authorization.
- A schema/policy PASS means only that supplied JSON meets local checks. It is not host acceptance, supplier approval or deployment authorization.
- NODE01 remains a logical software identity. An execution host is represented only as a separate `ExecutionHostInventory` record.

The service fixture uses a syntactically valid digest-shaped value solely for schema tests. It is not a verified image digest and must never be deployed.
