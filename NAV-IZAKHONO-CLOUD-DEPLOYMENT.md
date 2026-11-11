# IZAKHONO NAV — NODE01 Deployment Runbook

## Deployment target
- GitHub repository: https://github.com/bevanshelton-netizen/izakhono-builder
- Branch: main
- Product: IZAKHONO NAV
- Build context: .
- Dockerfile: Dockerfile
- Container port: 80
- Health path: /health.json
- Intended public hostname: nav.izakhono.africa

## Repository deployment contract
The root `.izakhono.json` is the IZAKHONO Cloud v1 deployment manifest. It instructs the Fast Build runner to build the root Dockerfile, expose container port 80, and require a successful HTTP response from `/health.json` before promotion.

The root Dockerfile packages only `public/ai-core/nav/` into the NGINX web root. The GitHub Actions workflow `.github/workflows/nav-container.yml` independently builds the image and smoke-tests the health endpoint, HTML shell, PWA manifest, and service worker. This CI verification is separate from an actual NODE01 deployment.

## Owner Console deployment
1. Open the IZAKHONO Cloud Owner Console from the running NODE01 software environment.
2. In Owner Mode / Fast Build, submit the repository URL above and select branch `main`.
3. Allow the repository-aware importer to derive the project identity and read `.izakhono.json`.
4. Submit the deployment to the Cloud Runner.
5. Wait for the runner to build, start, health-check, and promote the container. Promotion is accepted only when the project reports LIVE and the health check passes.
6. Record the deployment ID, release/image identity, internal service URL, and health-check result in the release record.

The documented local Owner Console API is bound to `http://127.0.0.1:8787`; it must be invoked from within the running NODE01 software environment. It is not a public internet endpoint and must not be exposed merely to make remote deployment possible.

## Public edge and domain cutover gates
Do not change DNS or remove the existing external route until all of the following are evidenced:
- NODE01 Cloud reports the NAV project LIVE.
- The internal service returns the expected NAV HTML, manifest, service worker, and `health.json`.
- IZAKHONO EDGE routes the intended hostname to the healthy service.
- TLS certificate is valid and HTTPS works from an external network.
- Android install/PWA launch, navigation shell, and offline shell are tested on a real device.
- Backup and restore have been tested.
- Rollback/failback to the previous known-good route has been tested.
- Secrets, owner/admin interfaces, and customer data are not publicly exposed.

## Rollback
If any post-promotion check fails, use the Cloud deployment history/rollback mechanism to restore the previous known-good release. Keep the current DNS and external fallback unchanged until the owned route passes all gates.

## Release status discipline
- BUILT / VERIFIED LOCALLY: source or container build has passed local/CI checks.
- OWNED LIVE VERIFIED: NODE01 Cloud reports LIVE and the service is independently reachable through IZAKHONO Edge.
- NOT YET PUBLIC: owned runtime may exist internally, but public DNS/TLS/device checks have not passed.

A successful GitHub Actions run does not by itself mean NAV is deployed to NODE01 or publicly live.
