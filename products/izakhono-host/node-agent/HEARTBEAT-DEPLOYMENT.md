# IZAKHONO NODE Heartbeat Deployment

The persistent heartbeat runner is `heartbeat-runner.mjs` and the Linux service definition is `izakhono-node-heartbeat.service`.

## Node configuration

Create `/etc/izakhono/node.env` with:

```text
IZAKHONO_NODE_ID=NODE-01
IZAKHONO_HEARTBEAT_INTERVAL_MS=60000
```

An optional `IZAKHONO_HEARTBEAT_COMMAND` can receive each JSON heartbeat on stdin and return an acknowledgement on stdout. Do not place credentials in the repository or in the service file.

## Install

From the IZAKHONO repository root on the NODE:

```bash
install -d -m 0750 /etc/izakhono /var/lib/izakhono-node
install -m 0644 products/izakhono-host/node-agent/izakhono-node-heartbeat.service /etc/systemd/system/izakhono-node-heartbeat.service
systemctl daemon-reload
systemctl enable --now izakhono-node-heartbeat.service
```

## Verify

```bash
systemctl status izakhono-node-heartbeat.service
cat /var/lib/izakhono-node/heartbeat.json
```

The service is intentionally fail-safe: without a configured transport it records a local heartbeat but does not claim control-plane delivery. A NODE is only considered connected when the control plane receives and acknowledges the heartbeat.
