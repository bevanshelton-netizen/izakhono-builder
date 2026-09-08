#!/usr/bin/env bash
set -euo pipefail

[[ "$(id -u)" -eq 0 ]] || { echo "Run as root on a k3s server node." >&2; exit 2; }
command -v k3s >/dev/null || { echo "k3s is required." >&2; exit 2; }

for node in node01 node02 node03 node04; do
  ready="$(k3s kubectl get node "$node" -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null || true)"
  [[ "$ready" == "True" ]] || { echo "FAIL: $node not Ready" >&2; exit 4; }
done

k3s kubectl -n longhorn-system get daemonset longhorn-manager >/dev/null
desired="$(k3s kubectl -n longhorn-system get daemonset longhorn-manager -o jsonpath='{.status.desiredNumberScheduled}')"
ready="$(k3s kubectl -n longhorn-system get daemonset longhorn-manager -o jsonpath='{.status.numberReady}')"
[[ "$desired" -ge 4 ]] || { echo "FAIL: expected Longhorn on four nodes, desired=$desired" >&2; exit 5; }
[[ "$ready" -eq "$desired" ]] || { echo "FAIL: Longhorn managers not all Ready ($ready/$desired)" >&2; exit 5; }

class="$(k3s kubectl get storageclass longhorn -o jsonpath='{.metadata.name}' 2>/dev/null || true)"
[[ "$class" == "longhorn" ]] || { echo "FAIL: longhorn StorageClass missing" >&2; exit 6; }

cat <<'YAML' | k3s kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: izakhono-storage-proof
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: longhorn
  resources:
    requests:
      storage: 1Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: izakhono-storage-proof
  namespace: default
spec:
  restartPolicy: Never
  containers:
    - name: proof
      image: busybox:1.37
      command: ["sh","-lc","echo IZAKHONO_DATA_PROOF > /proof/proof.txt && sync && cat /proof/proof.txt"]
      volumeMounts:
        - name: proof
          mountPath: /proof
  volumes:
    - name: proof
      persistentVolumeClaim:
        claimName: izakhono-storage-proof
YAML

k3s kubectl wait --for=condition=Ready pod/izakhono-storage-proof --timeout=5m
result="$(k3s kubectl logs izakhono-storage-proof)"
[[ "$result" == *"IZAKHONO_DATA_PROOF"* ]] || { echo "FAIL: volume write/read proof failed" >&2; exit 7; }

echo "IZAKHONO_DATA=PASS"
echo "REPLICA_TARGET=3"
echo "NOTE=Controlled node-loss and restore rehearsal are still required before production sign-off."
