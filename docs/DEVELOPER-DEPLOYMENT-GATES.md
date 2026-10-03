# IZAKHONO Developer Deployment Gates

A developer app does not become public merely because a build succeeded.

## State machine

idea -> building -> preview -> verified -> deployed -> monetizing -> scaled

Builder project state and deployment evidence are separate records.

## Deployment request

The Developer Factory can create a deployment request only after:
- the app passes factory verification;
- the Builder project is `deploy_ready`;
- a validated internal-repository commit exists;
- a release candidate identifies the exact revision.

The deployment request records:
- source-of-truth revision;
- internal repository head;
- deployment authority;
- runtime acceptance state;
- HTTPS 200 evidence state;
- TLS/DNS acceptance state;
- rollback-proof state.

## Public-live rule

`public_live` remains false until the deployment authority supplies evidence that the owned runtime independently:
1. executes the exact release candidate;
2. responds successfully over HTTPS;
3. passes TLS/DNS acceptance;
4. has a tested rollback path.

External hosting remains a reversible resilience route. It does not substitute for owned-runtime acceptance.

## Human / infrastructure gate

The Worker cannot manufacture NODE01 runtime evidence. A deployment request is therefore a controlled handoff to the owned deployment authority, not a false claim that production is live.

## Required next integration

Add a privileged deployment-evidence endpoint or deployment agent that accepts signed/owner-authorized evidence from NODE01 and atomically transitions:
- deployment_verified=true
- rollback_ready=true
- builder project status=deployed
- developer app stage=deployed

Only that evidence transition may permit `public_live=true`.
