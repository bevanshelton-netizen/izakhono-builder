#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Run as root." >&2
  exit 1
fi

need(){ command -v "$1" >/dev/null || { echo "Missing prerequisite: $1" >&2; exit 2; }; }
need python3
need docker
need curl
need openssl
need systemctl

docker info >/dev/null 2>&1 || {
  echo "Docker is not ready. Start the IZAKHONO owner host first." >&2
  exit 3
}

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTROL_SRC="$(cd "$HERE/../izakhono-control" && pwd)"

install -d -m 0755 /opt/izakhono-node /opt/izakhono-node/profiles /opt/izakhono-control
install -d -m 0700 /etc/izakhono
install -d -m 0750 /etc/izakhono/apps
install -d -m 0750 /var/lib/izakhono-node/jobs /var/lib/izakhono-node/evidence /var/lib/izakhono-node/apps

install -m 0755 "$HERE/node_agent.py" /opt/izakhono-node/node_agent.py
install -m 0755 "$HERE/deploy.sh" /opt/izakhono-node/deploy.sh
install -m 0755 "$HERE/prepare-allegro.sh" /opt/izakhono-node/prepare-allegro.sh
install -m 0644 "$HERE/profiles/allegro-vibez.production.json" /opt/izakhono-node/profiles/allegro-vibez.production.json
install -m 0644 "$HERE/izakhono-node.service" /etc/systemd/system/izakhono-node.service
install -m 0755 "$CONTROL_SRC/control.py" /opt/izakhono-control/control.py
install -m 0755 "$CONTROL_SRC/izakhonoctl.py" /opt/izakhono-control/izakhonoctl.py
install -m 0644 "$CONTROL_SRC/izakhono-control.service" /etc/systemd/system/izakhono-control.service

NODE_ENV=/etc/izakhono/node.env
CONTROL_ENV=/etc/izakhono/control.env
OWNER_TOKEN_FILE=/etc/izakhono/control.owner-token

if [ ! -f "$NODE_ENV" ]; then
  NODE_SECRET="$(openssl rand -hex 32)"
  umask 077
  cat >"$NODE_ENV" <<EOF
IZAKHONO_NODE_HOST=127.0.0.1
IZAKHONO_NODE_PORT=9191
IZAKHONO_NODE_ID=node01
IZAKHONO_NODE_SECRET=$NODE_SECRET
IZAKHONO_NODE_ROOT=/var/lib/izakhono-node
IZAKHONO_NODE_DEPLOYER=/opt/izakhono-node/deploy.sh
IZAKHONO_NODE_JOB_TIMEOUT=2700
IZAKHONO_NODE_ALLOWED_REPO_PREFIXES=file:///srv/izakhono-code/repos/;https://github.com/bevanshelton-netizen/
EOF
  chmod 600 "$NODE_ENV"
fi

# shellcheck disable=SC1090
source "$NODE_ENV"
: "${IZAKHONO_NODE_SECRET:?Node secret missing}"

if [ ! -f "$OWNER_TOKEN_FILE" ]; then
  umask 077
  openssl rand -hex 32 >"$OWNER_TOKEN_FILE"
  chmod 600 "$OWNER_TOKEN_FILE"
fi
CONTROL_TOKEN="$(tr -d '\r\n' <"$OWNER_TOKEN_FILE")"

umask 077
cat >"$CONTROL_ENV" <<EOF
IZAKHONO_CONTROL_HOST=127.0.0.1
IZAKHONO_CONTROL_PORT=9292
IZAKHONO_CONTROL_TOKEN=$CONTROL_TOKEN
IZAKHONO_NODE_URL=http://127.0.0.1:9191
IZAKHONO_NODE_SECRET=$IZAKHONO_NODE_SECRET
IZAKHONO_CODE_REPOS=/srv/izakhono-code/repos
IZAKHONO_ALLOW_GITHUB_MIRROR=true
EOF
chmod 600 "$CONTROL_ENV"

systemctl daemon-reload
systemctl enable --now izakhono-node.service
systemctl enable --now izakhono-control.service

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:9191/readyz >/dev/null 2>&1     && curl -fsS http://127.0.0.1:9292/healthz >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -fsS http://127.0.0.1:9191/readyz >/dev/null
curl -fsS http://127.0.0.1:9292/healthz >/dev/null

NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
EVIDENCE="/var/lib/izakhono-node/evidence/node01-activation-${NOW//[:]/}.txt"
cat >"$EVIDENCE" <<EOF
IZAKHONO_NODE_ACTIVATION_PROOF_VERSION=1
NODE_ID=node01
ACTIVATED_UTC=$NOW
NODE_URL=http://127.0.0.1:9191
CONTROL_URL=http://127.0.0.1:9292
NODE_READY=true
CONTROL_HEALTH=true
GITHUB_RUNNER_REQUIRED=false
IZAKHONO_CODE_SOURCE=/srv/izakhono-code/repos
OWNER_TOKEN_STORED=$OWNER_TOKEN_FILE
EOF
sha256sum "$EVIDENCE" >"$EVIDENCE.sha256"
chmod 600 "$EVIDENCE" "$EVIDENCE.sha256"

echo
echo "[PASS] IZAKHONO NODE 01 is active."
echo "Node:    http://127.0.0.1:9191"
echo "Control: http://127.0.0.1:9292"
echo "Owner token: $OWNER_TOKEN_FILE"
echo "Owner CLI: /opt/izakhono-control/izakhonoctl.py"
echo "ALLEGRO profile: /opt/izakhono-node/profiles/allegro-vibez.production.json"
echo "Evidence: $EVIDENCE"
echo "GitHub Actions runner registration is not required for IZAKHONO NODE jobs."
