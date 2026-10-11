# IZAKHONO NODE01 — Complete Platform Architecture

```text
                         INTERNET
                            |
                     [OWNED EDGE]
                  firewall / TLS / WAF
                            |
                  +---------+---------+
                  |                   |
             /commands             /seo
                  |                   |
          NODE01 CONTROL       SUPER SEO V5
             :8090                 :8097
                  \                   /
                   +------ PRIVATE --+
                          NETWORK
                             |
                     PRIVATE REGISTRY
                          :5000
                             |
                    persistent storage
                             |
                  +----------+----------+
                  |                     |
               BACKUPS               NODE02
             independent          warm standby
             failure domain       recovery target
```

## Layers

### 1. Hardware
Enterprise compute, ECC memory, redundant storage, redundant power and out-of-band management.

### 2. Host operating system
Hardened Linux, automatic security updates according to maintenance policy, Docker/OCI runtime, firewall and systemd.

### 3. Control plane
The NODE01 runtime owns workload intent, health state and deployment contracts. It is not given the Docker socket.

### 4. Workload plane
Applications run as isolated containers on a private `izakhono` network. Each production workload has an explicit image, port and health endpoint.

### 5. Registry
The private registry is localhost/private-network only. Public exposure is prohibited.

### 6. Edge
Public traffic terminates at the owned edge. TLS is handled there. Containers are never directly exposed merely because a workload is healthy.

### 7. Observability
Health, container state, disk capacity, backup age and heartbeat are mandatory operational signals.

### 8. Recovery
Backups are integrity-checked. Workloads are restored and promoted individually. Previous known-good images remain available for rollback.

## Production gate

`production_ready = host_ok AND control_healthy AND workload_healthy AND backup_fresh AND route_verified`

No single external provider is a required production dependency in this architecture.
