# IZAKHONO Contabo Runtime Fabric

**Status:** BUILT / VERIFIED LOCALLY (design + configuration only)

This package adds Contabo as a replaceable execution target underneath the IZAKHONO Runtime Fabric. Contabo is infrastructure, not the IZAKHONO control plane or source of truth.

## Logical identity boundary

`NODE01`–`NODE04` are **portable software/runtime identities**. They are never physical machine names and are not permanently tied to Contabo or any other provider.

The relationship is:

```text
IZAKHONO logical node identity
          |
          v
approved runtime host
          |
          v
Linux / OCI / Docker runtime
```

A runtime host may be rebuilt, replaced, moved between providers, or moved onto owned hardware without changing the logical node identity. The runtime binding is recorded separately through `izakhono.runtime-binding/v1`.

## Target profiles

| Profile | Contabo product | CPU | RAM | NVMe | Network |
|---|---|---:|---:|---:|---:|
| `plus4` | Cloud VPS Plus 4 (`V159`) | 4 vCPU | 8 GB | 150 GB | 500 Mbit/s |
| `plus6` | Cloud VPS Plus 6 (`V160`) | 6 vCPU | 12 GB | 300 GB | 500 Mbit/s |
| `plus8` | Cloud VPS Plus 8 (`V161`) | 8 vCPU | 24 GB | 450 GB | 1 Gbit/s |

The initial general-purpose IZAKHONO substrate profile is `plus8`. The existing mail-runtime acceptance baseline remains independently compatible with the previously approved Plus 4 target.

## Architecture

```text
                 IZAKHONO SOURCE / FORGE
                           |
                    immutable release
                           |
                 IZAKHONO RUNTIME FABRIC
                           |
             +-------------+-------------+
             |                           |
      owned runtime(s)             Contabo VPS
             |                           |
             +-------------+-------------+
                           |
                     EDGE / TLS / DNS
                           |
                        customer
```

## What the host provides

The bootstrap prepares an Ubuntu 24.04 LTS host for:

- Docker Engine + Compose plugin
- hardened SSH baseline
- UFW with only required public ports
- fail2ban
- automatic security updates
- node health endpoint
- immutable release directory
- application/runtime deployment directory
- backup staging directory
- systemd-managed runtime bootstrap

Optional AI/data services are enabled through Compose profiles rather than being forced onto every host.

## Required credentials

Never commit credentials. The provisioning script expects:

- `CONTABO_CLIENT_ID`
- `CONTABO_CLIENT_SECRET`
- `CONTABO_API_USER`
- `CONTABO_API_PASSWORD`
- `CONTABO_SSH_KEY_IDS`
- `CONTABO_IMAGE_ID`
- `CONTABO_REGION`

The official Contabo API supports OAuth credentials, compute provisioning, cloud-init `userData`, private networking, snapshots and instance actions.

## Provisioning

1. Copy `.env.example` to a local secret store outside Git.
2. Discover an Ubuntu 24.04 image and set `CONTABO_IMAGE_ID`.
3. Set `IZAKHONO_NODE_ID` to the logical identity being bound (`NODE01`–`NODE04`).
4. Set `IZAKHONO_RUNTIME_HOST_NAME` to the infrastructure host name. This is **not** the logical node identity.
5. Run `provision.sh plus8`.
6. Capture the returned instance ID and public IP.
7. Verify SSH, `/health`, Docker and the release identity.
8. Bind the logical identity to the verified host using the runtime-binding contract.
9. Put the host behind the approved EDGE/TLS path before public traffic is enabled.

No script in this package claims public availability merely because an instance was created.

## Release identity

Every workload deployed to the host must expose:

- product
- release version
- immutable build ID
- schema compatibility
- logical node ID
- runtime host
- owned/external route classification

The host is disposable. Rebuilding the host must not change the authoritative application source, logical node identity, or customer data.
