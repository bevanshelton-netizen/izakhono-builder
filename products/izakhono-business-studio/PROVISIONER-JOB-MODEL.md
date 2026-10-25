# IZAKHONO Provisioner Job Model

The Business Studio blueprint is the desired state. A Provisioner Job is the auditable execution request that turns that desired state into controlled provisioning work.

## Lifecycle

`QUEUED → VALIDATED → RUNNING → PROVISIONED → LIVE_VERIFIED`

Exceptional states are `BLOCKED` and `FAILED`. A job must never skip from a generated blueprint directly to `LIVE_VERIFIED`.

## Validation boundary

Before execution the Provisioner must:

1. validate the blueprint against `blueprint.schema.json`;
2. validate the requested capabilities against `provisioner-job.schema.json`;
3. reject capabilities not present in the blueprint workflow;
4. create one auditable job identifier;
5. initialize evidence for every requested capability;
6. keep provider credentials outside the job payload.

## Execution rule

The runtime executes only requested capabilities and records evidence per capability. Provider adapters may implement a capability, but the job state remains owned by IZAKHONO.

## Terminal-state rule

`PROVISIONED` means the requested provisioning workflow completed successfully.

`LIVE_VERIFIED` requires explicit acceptance evidence for the intended public runtime. CI success, a generated file, a provider response, or a DNS/TLS configuration attempt alone is insufficient.

## Failure and recovery

A failed capability moves the job to `FAILED` unless the failure is an external prerequisite that can be safely retried, in which case it may be `BLOCKED`. Retries must preserve the job identifier and append evidence rather than silently replacing history.

## Security

- No secrets in blueprints or job payloads.
- Provider credentials remain server-side.
- No arbitrary shell commands are accepted as job capabilities.
- Production activation remains evidence-gated.
