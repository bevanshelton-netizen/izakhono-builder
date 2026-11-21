# IZAKHONO HOST — Remote Compute Worker Node

This is the provider-neutral worker package for adding additional virtual machines or servers to the IZAKHONO compute fabric. It runs only the non-root IZAKHONO worker process. It does not expose public ports, mount a Docker socket, or execute arbitrary shell commands.

## Add a node

1. On the private HOST control node, issue a one-time enrollment token:
   ```sh
   bash ./ENROLL-COMPUTE-NODE.sh worker-jhb-02
   ```
2. Securely transfer the generated file from `worker-node/enrollments/worker-jhb-02.env` to the new machine as `worker-node/.env`. Do not send it through chat or commit it.
3. Ensure the new machine can reach the manager over a private network or authenticated private tunnel. Do not publish manager port 8082 to the internet.
4. From `worker-node`, run:
   ```sh
   bash ./ACTIVATE-WORKER.sh
   ```
5. The worker consumes the one-time token, receives its unique credential, and persists that credential in its own Docker volume. The activation script then removes the consumed token from `.env`.

Use a distinct worker ID and its own persistent volume on every host. Re-enroll a node from the control host if its worker credential volume is lost or compromised.

## Capacity and isolation

The worker advertises CPU and memory and receives only tasks within the current fixed allow-list. This release supports health-check, SHA-256 and echo jobs. Container build execution, GPU workloads and arbitrary application code remain disabled until the separate rootless BuildKit sandbox and artifact verification gates are delivered.

## Network

`COMPUTE_MANAGER_URL` must resolve to a private address reachable from the worker. Manager port 8082 is not published by the HOST Compose stack; use a private VPN or SSH tunnel. The worker node has no inbound port requirement.
