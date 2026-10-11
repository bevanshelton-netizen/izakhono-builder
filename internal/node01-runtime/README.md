# IZAKHONO NODE01

NODE01 is the owned execution node for IZAKHONO workloads. It is deliberately independent of Vercel, Netlify and Cloudflare deployment control.

## Layers

- **Control runtime:** `server.mjs` — health, status and authenticated deployment contract.
- **Private registry:** `docker-compose.yml` — local OCI registry bound to localhost:5000 and persisted on the NODE01 host.
- **Container:** `Dockerfile` — reproducible NODE01 control runtime.
- **Host bootstrap:** `install-node01.sh` — one-command installation on an owned Linux/Docker host.
- **Workload promotion:** `promote-super-seo-to-local-registry.sh` — promotes the approved SUPER SEO image into the private NODE01 registry.
- **Workload definition:** `super-seo.local.compose.yml` — declares SUPER SEO as a NODE01-managed workload on port 8097.
- **CI:** `.github/workflows/node01-runtime-ci.yml` — builds and runs a NODE01 canary on every relevant change.

## Ports

- NODE01 control runtime: `8090`
- Private workload registry: `127.0.0.1:5000`
- SUPER SEO workload: `8097`

## Security boundary

The control runtime only accepts approved image prefixes and requires `NODE01_ADMIN_TOKEN` for administrative operations. It does not expose the Docker socket. The private registry is localhost-only; workloads are placed on the internal `izakhono` network.

## Production direction

NODE01 is the first owned compute layer. Additional nodes can later register as NODE02, NODE03, etc., behind the same control, workload, health, networking and recovery contracts.
