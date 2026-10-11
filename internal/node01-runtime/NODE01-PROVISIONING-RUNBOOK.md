# IZAKHONO NODE01 — Provisioning Runbook

This is the canonical host bring-up sequence for the owned NODE01 appliance.

## Phase 1 — Physical acceptance

1. Rack the enterprise server.
2. Connect redundant power to the online UPS.
3. Connect management and both production network links.
4. Verify BMC/IPMI remote management.
5. Run ECC, storage and thermal diagnostics.
6. Record serials, drive layout, firmware versions and BMC state.

## Phase 2 — Operating system

1. Install a currently supported Linux Server LTS release.
2. Enable UEFI/Secure Boot where supported.
3. Enable TPM 2.0.
4. Apply all security updates.
5. Configure SSH keys and disable password SSH.
6. Enable host firewall with default-deny policy.
7. Enable AppArmor/equivalent mandatory access controls.
8. Configure time synchronisation and persistent logs.

## Phase 3 — Container foundation

1. Install Docker Engine and Compose.
2. Verify Docker daemon recovery after reboot.
3. Create the private `izakhono` network.
4. Deploy the NODE01 control runtime on port 8090.
5. Deploy the private registry on localhost port 5000.
6. Confirm both health checks are green.

## Phase 4 — Resilience

1. Install the NODE01 backup service and daily timer.
2. Configure backup storage outside NODE01's primary storage failure domain.
3. Run an initial backup.
4. Verify its SHA-256 manifest.
5. Perform a restore rehearsal before production promotion.

## Phase 5 — Workload promotion

1. Pull an approved workload image from the IZAKHONO namespace.
2. Start it with the approved port and health endpoint.
3. Require consecutive healthy checks.
4. Promote the route only after health is green.
5. Retain the previous known-good image for rollback.

Initial workload:

- `izakhono-super-seo`
- port `8097`
- health `/health`

## Phase 6 — Owned edge

1. Deploy the reverse proxy/TLS gateway on the edge zone.
2. Keep workload ports private unless explicitly promoted.
3. Route only to healthy services.
4. Verify certificates, DNS and external reachability independently.
5. Never call a route live until external verification succeeds.

## Phase 7 — NODE02

Provision NODE02 as a warm standby only after NODE01 passes the complete acceptance suite. Replicate approved configuration, workload manifests, registry metadata and image digests. Never copy administrative tokens or private keys through Git.

## Final acceptance

NODE01 is production-ready only when:

- hardware diagnostics are green;
- OS security baseline is green;
- control plane is healthy;
- registry is healthy and private;
- backup completed and verified;
- restore rehearsal passed;
- workload health is green;
- edge route is externally verified;
- rollback procedure has been tested.
