# IZAKHONO NODE01

NODE01 is the owned execution node for IZAKHONO workloads. It is deliberately independent of Vercel, Netlify and Cloudflare deployment control.

## Layers

- **Control runtime:** `server.mjs` — health, status and authenticated deployment contract.
- **Container:** `Dockerfile` — reproducible NODE01 runtime.
- **Host bootstrap:** `install-node01.sh` — one-command installation on an owned Linux/Docker host.
- **Workload deployment:** `deploy-super-seo.sh` — pulls the approved IZAKHONO SUPER SEO image and verifies `/health`.
- **CI:** `.github/workflows/node01-runtime-ci.yml` — builds and runs a NODE01 canary on every relevant change.

## Ports

- NODE01 control runtime: `8090`
- SUPER SEO workload: `8097`

## Security boundary

The runtime only accepts images under `ghcr.io/bevanshelton-netizen/`. Administrative operations require `NODE01_ADMIN_TOKEN`. Production deployment remains a host-level Docker operation; the control runtime does not expose the Docker socket.

## Production direction

NODE01 becomes the first owned compute layer. Additional nodes can later register as NODE02, NODE03, etc., behind the same control contract and health model.
