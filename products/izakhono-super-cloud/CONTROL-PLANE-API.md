# Super Cloud Control Plane API — V1

## Tenant

`POST /v1/tenants`

Creates an isolated cloud tenant.

`GET /v1/tenants/:tenantId`

Returns tenant status, quota and resource summary.

## Projects

`POST /v1/tenants/:tenantId/projects`

Creates a project.

`POST /v1/projects/:projectId/environments`

Creates development, preview, staging or production environments.

## Domains

`POST /v1/projects/:projectId/domains`

Registers a domain for ownership/verification and routing.

`POST /v1/domains/:domainId/verify`

Verifies DNS ownership and enables TLS provisioning.

## Workloads

`POST /v1/environments/:environmentId/workloads`

Creates a workload from a portable workload specification.

`GET /v1/workloads/:workloadId`

Returns desired state, observed state, region, provider adapter and health.

`POST /v1/workloads/:workloadId/reconcile`

Asks the infrastructure adapter to converge the workload to its desired state.

## Deployments

`POST /v1/projects/:projectId/deployments`

Creates a deployment from Git/image/source metadata.

`POST /v1/deployments/:deploymentId/promote`

Promotes a verified deployment to the requested environment.

`POST /v1/deployments/:deploymentId/rollback`

Restores the last verified healthy deployment.

## Infrastructure

`GET /v1/regions`

Lists capacity regions and health.

`GET /v1/capacity`

Returns aggregate compute, storage, network and accelerator capacity.

## Operations

`GET /v1/health`

Control-plane health.

`GET /v1/events`

Audited cloud events.

## Safety rule

The API may report `LIVE` only after the deployment has passed health checks and production evidence gates. A source commit or deployment request alone is never sufficient evidence of live service.
