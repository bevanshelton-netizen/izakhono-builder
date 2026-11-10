# IZAKHONO CINEMATIC AI — controlled release gate

This release guide is intentionally evidence-driven. A green source-code CI run does not prove that a Cloudflare Worker, D1 database, Media Runtime Fabric broker or GPU worker is deployed and healthy.

## 1. Required runtime configuration

Deploy the existing `products/izakhono-creator` Worker. Do not create a second Creator Worker or a parallel project/asset database.

Required Cloudflare Worker bindings:

- D1 binding `DB` pointing to the approved production `izakhono-creator` database. Supply the real `database_id` in the deployment configuration; the repository's current Wrangler file contains the logical database name but does not contain a production database ID.
- R2 binding `ASSETS` pointing to the approved `izakhono-creator-assets` bucket.

Required server-side secrets/variables:

- `CREATOR_GENERATION_SECRET` — service-to-service authentication for the cinematic API.
- `MEDIA_FABRIC_URL` — private-network or approved HTTPS broker base URL.
- `MEDIA_FABRIC_KEY` — broker internal key.

Never place these values in browser code, public environment variables, Git, logs or client-visible responses. The opaque per-job polling token is stored inside the private Creator project record.

## 2. Identity and tenant boundary

The cinematic API is service-to-service only. A trusted FORTRESS identity gateway must authenticate the human user, enforce tenant membership, derive the owner ID, and call the Worker with the server credential. Do not expose the shared Worker secret to a browser or mobile client. Before multi-tenant production, ensure project reads, writes, approvals, assets and job polling are scoped to the authenticated tenant at the gateway and storage layer.

The legacy Creator endpoints predate this API and need the same identity-gateway review before external multi-tenant use.

## 3. Owned Media Runtime Fabric

The existing broker supports `image`, `video`, `speech` and `transcription`. This cinematic adapter submits image/video work only. Confirm that:

- `/healthz` reports `ok:true`;
- the broker key and payload encryption key are healthy;
- replicated storage is enabled and verified;
- at least one healthy worker advertises the required image/video capability;
- worker GPU memory and capability declarations match the planned workload.

Do not call the fabric production-ready unless its own `production_ready` field is true.

## 4. Release commands

From the repository root, after the approved D1 ID and Cloudflare credentials are configured:

```bash
npx tsc --noEmit --skipLibCheck --target ES2022 --lib ES2022,DOM,DOM.Iterable --module ESNext --moduleResolution bundler products/izakhono-creator/src/index.ts products/izakhono-creator/src/cinematic-production-graph.ts products/izakhono-creator/src/cinematic-brief-compiler.ts products/izakhono-creator/src/cinematic-api.ts
npx tsx products/izakhono-creator/src/cinematic-production-graph.test.ts
npx tsx products/izakhono-creator/src/cinematic-brief-compiler.test.ts
npx tsx products/izakhono-creator/src/cinematic-api.test.ts
npx wrangler deploy --config products/izakhono-creator/wrangler.jsonc
```

## 5. End-to-end acceptance sequence

1. Verify `GET /health` reports D1 and R2 availability.
2. Through the trusted gateway, create a cinematic project with `POST /api/cinematic/projects`.
3. Read the returned project and verify the graph, private-by-default state, provisional assumptions and approval gates.
4. Complete script, storyboard and quality-check tasks only with evidence.
5. Approve the generation gate using the trusted approver identity.
6. Supply an approved PNG/JPEG/WebP keyframe and submit a per-shot vertical 9:16 video task through `POST /api/cinematic/projects/:id/tasks/:taskId/submit`.
7. Poll through the status route until the broker reports a terminal state.
8. Confirm that the task is marked complete only when artifact metadata and SHA-256 evidence are present.
9. Connect the returned artifact into Creator's asset vault and review/select it.
10. Run the existing master factory and render path; do not mark the master complete until a render worker supplies output evidence.
11. Approve distribution separately. Publishing must remain a separate action with its own explicit approval.

## 6. Release status definitions

- **Source committed:** code is on the feature branch.
- **CI passed:** the named GitHub Actions workflows completed successfully for the exact head SHA.
- **Merged:** GitHub confirms the PR is merged.
- **Preview deployed:** a deployment built the exact commit and passed health checks.
- **Production deployed:** the approved production Worker is serving the exact commit.
- **End-to-end verified:** a real project completed the acceptance sequence using the owned broker and a healthy worker.

Never promote one status into another without evidence.
