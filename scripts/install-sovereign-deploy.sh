#!/usr/bin/env bash
set -euo pipefail
[[ ${EUID:-$(id -u)} -eq 0 ]] || { echo 'Run as root' >&2; exit 1; }
for c in python3 git docker curl systemctl; do command -v "$c" >/dev/null || { echo "missing $c" >&2; exit 20; }; done
install -d -m 0755 /opt/izakhono-node /opt/izakhono-control /opt/izakhono-code /etc/izakhono/apps /var/lib/izakhono-node /srv/izakhono-code/repos
install -m 0755 products/izakhono-node/node_agent.py /opt/izakhono-node/node_agent.py
install -m 0755 products/izakhono-node/deploy.sh /opt/izakhono-node/deploy.sh
install -m 0644 products/izakhono-node/izakhono-node.service /etc/systemd/system/izakhono-node.service
install -m 0755 products/izakhono-control/control.py /opt/izakhono-control/control.py
install -m 0644 products/izakhono-control/izakhono-control.service /etc/systemd/system/izakhono-control.service
install -m 0755 products/izakhono-code/create-repo.sh /opt/izakhono-code/create-repo.sh
install -m 0755 products/izakhono-code/migrate-mirror.sh /opt/izakhono-code/migrate-mirror.sh
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
