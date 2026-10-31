# KORA WORKLOAD CONTRACT v1

## Purpose

KORA is registered with IZAKHONO as a portable workload. The application is deployed from its immutable source/build artifact and consumes the provider-neutral Software NODE runtime contract.

## Workload identity

- workloadId: `kora-network`
- workloadClass: `web-application`
- runtime: `node20`
- internalPort: `3000`
- healthPath: `/api/health`
- publicHost: `streamkoraafrica.com`
- currentCapacityAdapter: `vercel`
- targetCapacityAdapter: `izakhono-software-node`

## Required NODE capabilities

A target NODE must provide:

- authenticated control-plane relationship
- Node.js/container runtime
- persistent workload state
- network connectivity
- HTTP ingress capability
- TLS/edge capability or an attached IZAKHONO edge
- health monitoring
- backup/restore capability
- FORTRESS security gate

## Artifact contract

KORA's Docker image is the portable execution artifact. The image exposes port 3000 and starts the Next.js production runtime. Build-time sentinel credentials are non-production only; production secrets must be injected by the runtime and never baked into the image. fileciteturn141file0

## Runtime acceptance

A KORA Software NODE candidate is not promoted until all of the following are evidenced:

1. workload image built successfully;
2. container starts successfully;
3. `/api/health` returns HTTP 200;
4. application reports healthy runtime state;
5. public hostname routes to the candidate;
6. HTTPS succeeds with trusted certificate;
7. required production services are reachable;
8. no critical runtime errors are detected;
9. rollback target remains available.

## Cutover rule

Vercel remains the reversible capacity adapter until the complete acceptance contract passes on an IZAKHONO Software NODE. DNS/routing must only be changed after acceptance evidence is persisted.

## Rollback

If post-cutover health fails, the control plane must restore the last known-good routing target and record the event. No irreversible infrastructure assumption may be introduced by the workload.
