# ISN-01 — First IZAKHONO Engine Node Enrollment

This is the controlled first-node proof for IZAKHONO Containers / IZAKHONO Engine.

## Safety rule

Do **not** install the persistent agent until preflight is fully green.

## 1. Get the feature branch onto ISN-01

```bash
git fetch origin
git checkout feature/izakhono-containers
cd izakhono-containers/engine
```

## 2. Set the control plane URL

```bash
export IZ_CONTROL_URL="http://CONTROL-PLANE-IP:8080"
```

For the first proof, use a LAN/VPN address only. Do not expose port 8080 publicly.

## 3. Run read-only preflight

```bash
chmod +x isn01-preflight.sh
./isn01-preflight.sh
```

Expected result:

```text
RESULT: ISN-01 is ready for IZAKHONO Engine enrollment.
```

## 4. Create an enrollment secret

Generate a random token on the control-plane machine:

```bash
openssl rand -hex 32
```

Set the same value in both places.

Control plane:

```bash
export IZ_NODE_ENROLL_TOKEN="<generated-token>"
node server.js
```

ISN-01:

```bash
export IZ_NODE_ENROLL_TOKEN="<generated-token>"
export IZ_NODE_NAME="ISN-01"
export IZ_NODE_REGION="Johannesburg"
```

## 5. Verify registration manually before installing systemd

```bash
node agent.js
```

Then check the control plane:

```bash
curl -fsS "$IZ_CONTROL_URL/api/nodes"
```

ISN-01 should appear online with a recent heartbeat. Stop the foreground agent with Ctrl+C after proof.

## 6. Only after manual proof, install the persistent service

```bash
sudo -E ./install-agent.sh
```

Verify:

```bash
systemctl status izakhono-engine-agent --no-pager
journalctl -u izakhono-engine-agent -n 100 --no-pager
```

## 7. First workload

Use a disposable low-risk image first, not Allegro or KORA.

```bash
curl -X POST "$IZ_CONTROL_URL/api/deployments" \
  -H "content-type: application/json" \
  -d '{"app":"engine-proof","image":"nginx:alpine","node":"ISN-01","port":8088}'
```

Then verify on ISN-01:

```bash
docker ps
curl -I http://127.0.0.1:8088
```

## Production-readiness boundary

A successful first workload proves node enrollment, heartbeat, scheduler dispatch, image pull, container start, and status reporting.

It does **not yet** prove public-production readiness. Before production traffic, add TLS/mTLS, authenticated registry, persistent metadata, ingress, health-based rollback, secret injection, logs/metrics, and backups.
