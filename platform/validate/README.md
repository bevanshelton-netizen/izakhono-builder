# IZAKHONO HOST validation foundation

This directory contains the first read-only validation implementation for service manifests and execution-host inventory.

## Contents

- `schemas/service-definition.schema.json` — strict JSON Schema Draft 2020-12 contract for service definitions.
- `schemas/execution-host-inventory.schema.json` — strict contract for separately inventoried execution hosts.
- `policies/hosting-policy.v1.json` — baseline registry, security, production-approval and public-ingress policy.
- `fixtures/services/` and `fixtures/hosts/` — synthetic, non-deployable test records.
- `validate.py` — schema and policy validator; reads JSON only and makes no network or infrastructure changes.
- `tests/` — regression tests for mandatory policy behavior.

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

## Safety properties

- No provider credentials, deployment credentials or secrets are read.
- No provider API, host, network endpoint or shell command is invoked.
- No provisioning, deployment, DNS, firewall, mail-routing or production action exists in this validator.
- The sample execution-host record is explicitly `unverified` and has no supplier resource ID or locator.
- A schema/policy PASS means only that the supplied JSON meets these local checks. It is not host acceptance, supplier approval or deployment authorization.
- NODE01 remains a logical software identity. An execution host is represented only as a separate `ExecutionHostInventory` record.

The service fixture uses a syntactically valid digest-shaped value solely for schema tests. It is not a verified image digest and must never be deployed.
