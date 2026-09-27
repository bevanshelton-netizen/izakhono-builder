# IZAKHONO DOCFLOW public cutover

This package moves DOCFLOW from a verified NODE01 deployment to a public owned route without skipping evidence gates.

## Gate order

1. **NODE01 local production**
   - run `owner-node/START-IZAKHONO-DOCFLOW.cmd`
   - deployment uses IZAKHONO CODE -> CONTROL -> NODE
   - `/api/ready` must pass
   - backup + isolated restore proof must pass
   - no DNS or public EDGE is changed

2. **Stage the owned EDGE route**
   - choose the approved DOCFLOW hostname
   - run `STAGE-DOCFLOW-EDGE.ps1 -Hostname <approved-hostname>`
   - the script verifies NODE01 readiness and writes a Caddy snippet only
   - it does not alter the live Caddy stack or DNS

3. **Dry-run EDGE activation**
   - run `ACTIVATE-DOCFLOW-EDGE.ps1`
   - this checks the staged route and NODE01 readiness
   - nothing is applied without `-Apply`

4. **Activate the local EDGE route**
   - only after the hostname/DNS plan has been reviewed
   - run `ACTIVATE-DOCFLOW-EDGE.ps1 -Apply`
   - this updates the owner-controlled Caddy route
   - public reachability is still not assumed

5. **DNS/TLS and public acceptance**
   - point the approved hostname at the owned EDGE through the actual DNS control plane
   - preserve a verified external resilience route
   - run:
     `VERIFY-DOCFLOW-PUBLIC.ps1 -Hostname <approved-hostname> -FallbackUrl <verified-https-fallback>`

The verifier requires all of the following before it returns `OWNED_PUBLIC_GATES_PASS`:

- DNS A/AAAA resolution
- TCP 443 reachability
- valid HTTPS application health
- production readiness with the DOCFLOW database available
- the intended DOCFLOW homepage
- an independently reachable HTTPS fallback
- readable TLS certificate metadata

## Evidence boundary

Repository CI can prove the scripts, container, database, backup/restore logic and safety rules. It cannot prove the actual owner machine, public DNS delegation, router/ISP state or public certificate until the scripts run against NODE01 and the chosen hostname.

The DOCFLOW manifest must remain **NOT YET PUBLIC** until the physical deployment and public verification reports actually pass.
