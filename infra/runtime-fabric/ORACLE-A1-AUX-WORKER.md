# IZAKHONO Runtime Fabric — Oracle A1 Auxiliary Worker

**Status:** Optional external auxiliary capacity  
**Purpose:** Low-cost development, CI, queue and lightweight inference support  
**Authority:** Never a source of truth and never a mandatory launch gate

Oracle Cloud's Always Free Ampere A1 allowance can provide up to the Always Free tenancy limit documented by Oracle. Capacity is region-dependent and free instances may not always be available. IZAKHONO therefore treats an Oracle A1 instance as opportunistic auxiliary capacity, not as guaranteed infrastructure.

## Approved role

An Oracle A1 worker may run:

- non-sensitive build/test jobs;
- stateless queue workers;
- public-data AI benchmarking;
- development services that are ARM-compatible;
- health probes and disposable preview workloads.

It must not become the sole location for:

- authoritative source code;
- production secrets;
- customer databases;
- FORTRESS trust intelligence;
- payment credentials;
- DNS/TLS authority;
- irreplaceable artefacts.

## Runtime Fabric rule

The worker participates only after it has:

1. a unique runtime identity;
2. an approved immutable release identity;
3. a health endpoint;
4. outbound and inbound network rules reviewed;
5. secrets supplied outside source control;
6. backup/restore or reproducibility appropriate to its workload;
7. a tested removal path showing the portfolio continues without it.

Recommended label:

`EXTERNAL-AUX-ORACLE-A1`

It is not automatically a production resilience target. Promotion to a public resilience runtime requires the full Runtime Fabric deployment gate.

## SUPER AI use

For AI work, prefer CPU-appropriate local/open-weight models or queue/control workloads. Do not assume the A1 free allowance can run very large models. Hosted external model APIs remain separate adapters and must follow SUPER AI's data-classification boundary.

## Bootstrap template

`oracle-a1-cloud-init.yaml` provides a secret-free ARM-compatible auxiliary-worker bootstrap. It installs basic tooling, creates a locked service user and exposes a **loopback-only** health file/service. It intentionally does not open public firewall ports or grant cloud-admin privileges.

The bootstrap is not a provisioning engine and does not create an Oracle account, tenancy, VCN or compute instance.

## Provisioning boundary

This repository does not claim an Oracle tenancy or instance has been created. Actual provisioning requires the account owner to have an Oracle Cloud tenancy, select the home region, accept Oracle's current terms and create the VM. Once a real instance exists, register its health endpoint in the Runtime Fabric configuration and verify it before assigning work.
