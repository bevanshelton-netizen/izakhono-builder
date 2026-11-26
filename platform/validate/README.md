# IZAKHONO HOST validation foundation

This directory contains read-only validation and planning tools for service manifests and execution-host inventory.

## Contents

- `schemas/service-definition.schema.json` — strict JSON Schema Draft 2020-12 contract for service definitions.
- `schemas/execution-host-inventory.schema.json` — strict contract for separately inventoried execution hosts.
- `policies/hosting-policy.v1.json` — baseline registry, security, production-approval and public-ingress policy.
- `fixtures/services/` and `fixtures/hosts/` — synthetic, non-deployable test records.
- `validate.py` — schema and policy validator; reads JSON only and makes no network or infrastructure changes.
- `inventory_plan.py` — deterministic read-only placement planner. It compares declared service demand with explicitly approved inventory records.
- `tests/` — regression tests for validation and planning policy.

## Run locally

Python 3.12 is used in CI. Install the pinned validation dependency and run:

```sh
python -m pip install 'jsonschema==4.23.0'
python platform/validate/validate.py
python -m unittest discover -s platform/validate/tests -v
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

The supplied host fixture is deliberately unverified, so this example must return `BLOCKED_NO_ELIGIBLE_HOST` (exit code 3). A `PLAN_READY` result requires an inventory record that passes schema and host policy checks, is approved for the requested environment and role, has a separately identified execution resource, supported OS, evidence and approval references, and sufficient declared schedulable capacity.

The planner multiplies CPU and memory by replica count and sums persistent storage mounts. Inventory capacity is interpreted as schedulable capacity, not gross physical capacity. Keep those values current and do not claim already-allocated resources as available. Selection is deterministic by host ID; it is not a live utilisation-aware scheduler.

## Safety properties

- No provider credentials, deployment credentials or secrets are read.
- No provider API, host, network endpoint or shell command is invoked.
- No provisioning, deployment, DNS, firewall, mail-routing or production action exists in these tools.
- The sample execution-host record is explicitly `unverified` and has no supplier resource ID or locator.
- The plan always declares `executionPermitted: false`, `deploymentPerformed: false`, and an empty action list. A plan is not authorization.
- A schema/policy PASS means only that supplied JSON meets local checks. It is not host acceptance, supplier approval or deployment authorization.
- NODE01 remains a logical software identity. An execution host is represented only as a separate `ExecutionHostInventory` record.

The service fixture uses a syntactically valid digest-shaped value solely for schema tests. It is not a verified image digest and must never be deployed.
