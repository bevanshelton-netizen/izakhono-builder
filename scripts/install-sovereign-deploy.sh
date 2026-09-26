#!/usr/bin/env bash
set -euo pipefail
[[ ${EUID:-$(id -u)} -eq 0 ]] || { echo 'Run as root' >&2; exit 1; }
for c in python3 git docker curl systemctl; do command -v "$c" >/dev/null || { echo "missing $c" >&2; exit 20; }; done
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WAVE1_ROOT=/opt/izakhono/wave1
install -d -m 0755 /opt/izakhono-node /opt/izakhono-control /opt/izakhono-code /etc/izakhono/apps /var/lib/izakhono-node /srv/izakhono-code/repos
install -d -m 0755 "$WAVE1_ROOT/products/izakhono-node/profiles/wave1" "$WAVE1_ROOT/infra/public-cutover" /opt/izakhono/runtime-fabric /opt/izakhono/bin /opt/izakhono/evidence
install -m 0755 "$ROOT_DIR/products/izakhono-node/node_agent.py" /opt/izakhono-node/node_agent.py
install -m 0755 "$ROOT_DIR/products/izakhono-node/deploy.sh" /opt/izakhono-node/deploy.sh
install -m 0644 "$ROOT_DIR/products/izakhono-node/izakhono-node.service" /etc/systemd/system/izakhono-node.service
install -m 0755 "$ROOT_DIR/products/izakhono-control/control.py" /opt/izakhono-control/control.py
install -m 0644 "$ROOT_DIR/products/izakhono-control/izakhono-control.service" /etc/systemd/system/izakhono-control.service
install -m 0755 "$ROOT_DIR/products/izakhono-code/create-repo.sh" /opt/izakhono-code/create-repo.sh
install -m 0755 "$ROOT_DIR/products/izakhono-code/migrate-mirror.sh" /opt/izakhono-code/migrate-mirror.sh
BUILDER_BUNDLE_REF="$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null || true)"
if [[ ! "$BUILDER_BUNDLE_REF" =~ ^[0-9a-f]{40}$ ]]; then
  BUILDER_BUNDLE_REF=UNATTESTED
fi
printf '%s\n' "$BUILDER_BUNDLE_REF" > "$WAVE1_ROOT/BUILDER_REF"
chmod 0644 "$WAVE1_ROOT/BUILDER_REF"

WAVE1_BUNDLE_SHA256="$(bash "$ROOT_DIR/scripts/launch-stack/compute-wave1-bundle-id.sh" "$ROOT_DIR")"
[[ "$WAVE1_BUNDLE_SHA256" =~ ^[0-9a-f]{64}$ ]] || { echo '[FAIL] Invalid Wave 1 bundle digest.' >&2; exit 21; }
printf '%s\n' "$WAVE1_BUNDLE_SHA256" > "$WAVE1_ROOT/BUNDLE_SHA256"
chmod 0644 "$WAVE1_ROOT/BUNDLE_SHA256"

install -m 0755 "$ROOT_DIR/products/izakhono-node/wave1_deploy.py" "$WAVE1_ROOT/products/izakhono-node/wave1_deploy.py"
install -m 0644 "$ROOT_DIR/products/izakhono-node/profiles/wave1/allegro-vibez.production.json" "$WAVE1_ROOT/products/izakhono-node/profiles/wave1/allegro-vibez.production.json"
install -m 0644 "$ROOT_DIR/products/izakhono-node/profiles/wave1/the-chancellor.production.json" "$WAVE1_ROOT/products/izakhono-node/profiles/wave1/the-chancellor.production.json"
install -m 0644 "$ROOT_DIR/infra/public-cutover/wave1-registry.json" "$WAVE1_ROOT/infra/public-cutover/wave1-registry.json"
install -m 0644 "$ROOT_DIR/infra/runtime-fabric/allegro-vibez.json" /opt/izakhono/runtime-fabric/allegro-vibez.json
install -o root -g root -m 0755 "$ROOT_DIR/scripts/launch-stack/run-wave1-local-proof.sh" /opt/izakhono/bin/run-wave1-local-proof
install -o root -g root -m 0755 "$ROOT_DIR/scripts/launch-stack/run-allegro-local-proof.sh" /opt/izakhono/bin/run-allegro-local-proof
if ! id izakhono-code >/dev/null 2>&1; then useradd --system --create-home --home-dir /srv/izakhono-code --shell /usr/bin/git-shell izakhono-code; fi
chown -R izakhono-code:izakhono-code /srv/izakhono-code
if [[ ! -f /etc/izakhono/node.env ]]; then
  umask 077
  SECRET="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
  cat > /etc/izakhono/node.env <<EOF
IZAKHONO_NODE_HOST=127.0.0.1
IZAKHONO_NODE_PORT=9191
IZAKHONO_NODE_ROOT=/var/lib/izakhono-node
IZAKHONO_NODE_DEPLOYER=/opt/izakhono-node/deploy.sh
IZAKHONO_NODE_SECRET=$SECRET
EOF
fi
if [[ ! -f /etc/izakhono/control.env ]]; then
  umask 077
  NODE_SECRET="$(sed -n 's/^IZAKHONO_NODE_SECRET=//p' /etc/izakhono/node.env)"
  CONTROL_TOKEN="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
  cat > /etc/izakhono/control.env <<EOF
IZAKHONO_CONTROL_HOST=127.0.0.1
IZAKHONO_CONTROL_PORT=9292
IZAKHONO_CONTROL_TOKEN=$CONTROL_TOKEN
IZAKHONO_NODE_URL=http://127.0.0.1:9191
IZAKHONO_NODE_SECRET=$NODE_SECRET
EOF
fi
systemctl daemon-reload
systemctl enable --now izakhono-node izakhono-control
curl -fsS http://127.0.0.1:9191/healthz >/dev/null
curl -fsS http://127.0.0.1:9292/healthz >/dev/null
printf 'IZAKHONO_SOVEREIGN_DEPLOY=READY\n'
printf 'Node: http://127.0.0.1:9191\nControl: http://127.0.0.1:9292\nCode root: /srv/izakhono-code/repos\n'
printf 'Secrets remain under /etc/izakhono and must not be committed or pasted into chat.\n'
