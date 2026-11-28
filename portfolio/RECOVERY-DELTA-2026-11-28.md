# Recovery Inventory Delta — 2026-11-28

This addendum records findings from the second deployment inspection pass.

## Confirmed deployment defects and mapping risks

### FORTRESS
- `fortress-core-engine`: latest production deployment is ERROR because Vercel reports no Node entrypoint in the configured root. Inspect project root and actual application type; do not paper over this by adding a dummy entrypoint.
- `fortress-bank-onboarding`: READY production-target deployment record exists. This is deployment evidence only, not proof of live banking, regulated permissions or customer acceptance.
- `fortress-african-economic-unity`: READY production-target deployment record exists.
- `shelton-fortress`: latest global-asset-management preview is READY. Project has SSO protection enabled for deployments except custom domains. Preserve this access control.
- `fortress-compliance-intelligence`: new project points to SHELTON-FORTRESS and root `apps/compliance-portal`; no deployment found yet. The prior deployment request was rate-limited by the account's daily deployment API quota.

### Incorrectly associated FORTRESS-named project
- `izakhono-fortress-intelligence` is not the new Compliance Intelligence deployment target. Its latest READY preview is connected to `izakhono-builder` and branch `feat/worknow-global-workforce-core-v1`, with commit message “Add WORKNOW connector-mode policy core”. Do not deploy the FORTRESS Compliance application into it or treat the project name as proof of its actual source. It must be renamed/reassigned only after the current app mapping is verified and an owner-approved migration plan exists.

### Other project defects / status
- `kora-network`: latest preview is ERROR because configured Vercel root directory `kora-network` does not exist in the selected source. Recover repository mapping and correct the root only after locating the real KORA source.
- `the-business-of-music`: latest preview is READY on `feature/ipay-device-ecosystem-v1`; this is a preview, not production promotion.
- `allegro-vibez`: latest artist-profile preview is READY; validate artist ownership, publishing permissions and production acceptance.
- `worknow-sa`, `yenzanow`, `auto-ai`, `shelton-freight-group`: READY deployment records exist; application health, custom domains and operational acceptance remain to be tested.
- `bevan-shelton-storefront` and `bevan-shelton-books`: both have READY production-target deployment records. They remain distinct candidate projects; confirm which is the $7 Topic PDF storefront and which is the separate author/books collection before edits.
- `the-chancellor`: READY production-target deployment record on main. Payment, session, data-store and security gates in the repository README still apply.
- Edu-Build online classroom and online university have READY production-target deployment records, while the canonical ECD360 repository still identifies external staging gates as open.

## DOXA finding
The FORTRESS repository contains a branch named `doxa-sure-engine-1`. Its README is the same FORTRESS Alpha overview; a default-branch code search for “DOXA sure” returned no matches. This is not enough evidence to identify a separate DOXA product or confirm DOXA as a chosen brand. Preserve the branch for later history review; do not merge or rebrand anything based only on the branch name.

## Important Vercel interpretation
The inspected Vercel project records commonly report `live: false` even where a deployment is `READY` and has a production target. Therefore, report these as READY deployment artifacts, not as verified live customer services. Custom-domain routing, DNS/TLS, application health, authentication, persistence, backup/restore and user acceptance must be tested separately.
