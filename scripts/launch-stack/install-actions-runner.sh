#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo 'Run as root (sudo).'
  exit 1
fi

REPO_URL="${1:-}"
TOKEN="${2:-${IZAKHONO_GITHUB_RUNNER_TOKEN:-}}"
RUNNER_VERSION="${IZAKHONO_ACTIONS_RUNNER_VERSION:-2.337.0}"
RUNNER_SHA256="${IZAKHONO_ACTIONS_RUNNER_SHA256:-70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613}"
RUNNER_USER="${IZAKHONO_ACTIONS_RUNNER_USER:-izakhono-runner}"
RUNNER_NAME="${IZAKHONO_ACTIONS_RUNNER_NAME:-izakhono-node-01}"
RUNNER_LABELS="${IZAKHONO_ACTIONS_RUNNER_LABELS:-izakhono}"
RUNNER_HOME=/opt/izakhono/actions-runner
EVIDENCE_DIR=/opt/izakhono/evidence

[[ "$REPO_URL" =~ ^https://github\.com/bevanshelton-netizen/[A-Za-z0-9._-]+$ ]] || {
  echo 'Usage: install-actions-runner.sh https://github.com/bevanshelton-netizen/<repo>'
  exit 2
}
[[ "$TOKEN" =~ ^[A-Za-z0-9_-]{20,200}$ ]] || {
  echo 'A valid short-lived GitHub runner registration token is required through IZAKHONO_GITHUB_RUNNER_TOKEN or argument 2.'
  exit 2
}
[[ "$RUNNER_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Unsafe runner version.'; exit 2; }
[[ "$RUNNER_SHA256" =~ ^[0-9a-f]{64}$ ]] || { echo 'Unsafe runner SHA-256.'; exit 2; }
[[ "$RUNNER_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || { echo 'Unsafe runner user.'; exit 2; }
[[ "$RUNNER_NAME" =~ ^[A-Za-z0-9._-]{3,64}$ ]] || { echo 'Unsafe runner name.'; exit 2; }
[[ "$RUNNER_LABELS" =~ ^[A-Za-z0-9._,-]{1,128}$ ]] || { echo 'Unsafe runner labels.'; exit 2; }

docker info >/dev/null 2>&1 || { echo 'Docker is not available. Start the IZAKHONO owner host first.'; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update >/dev/null
apt-get install -y --no-install-recommends ca-certificates curl git tar >/dev/null

if ! id "$RUNNER_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$RUNNER_HOME" --shell /bin/bash "$RUNNER_USER"
fi
getent group docker >/dev/null 2>&1 && usermod -aG docker "$RUNNER_USER"
install -d -o "$RUNNER_USER" -g "$RUNNER_USER" -m 0750 "$RUNNER_HOME"
install -d -m 0750 "$EVIDENCE_DIR"

cd "$RUNNER_HOME"

if [ -f .runner ] && [ -x ./svc.sh ]; then
  echo 'Existing IZAKHONO Actions runner registration found; restarting service without rotating registration.'
  ./svc.sh stop >/dev/null 2>&1 || true
  ./svc.sh start
  ./svc.sh status
  exit 0
fi

archive="$(mktemp)"
trap 'rm -f "$archive"' EXIT
url="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz"

echo "Downloading pinned GitHub Actions runner v${RUNNER_VERSION}..."
curl --fail --location --retry 3 --silent --show-error "$url" -o "$archive"
printf '%s  %s\n' "$RUNNER_SHA256" "$archive" | sha256sum -c - >/dev/null

find "$RUNNER_HOME" -mindepth 1 -maxdepth 1 ! -name '.runner' -exec rm -rf {} +
tar -xzf "$archive" -C "$RUNNER_HOME"
chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_HOME"

./bin/installdependencies.sh >/dev/null

safe_repo="$REPO_URL"
safe_name="$RUNNER_NAME"
safe_labels="$RUNNER_LABELS"
safe_token="$TOKEN"
su -s /bin/bash "$RUNNER_USER" -c "./config.sh --url '$safe_repo' --token '$safe_token' --unattended --replace --name '$safe_name' --labels '$safe_labels' --work '_work'"

./svc.sh install "$RUNNER_USER"
./svc.sh start
./svc.sh status

now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
evidence="$EVIDENCE_DIR/actions-runner-${RUNNER_NAME}-${now//[:]/}.txt"
umask 077
cat > "$evidence" <<EOF
IZAKHONO_ACTIONS_RUNNER_PROOF_VERSION=1
REPOSITORY=$REPO_URL
RUNNER_NAME=$RUNNER_NAME
LABELS=self-hosted,linux,x64,$RUNNER_LABELS
RUNNER_VERSION=$RUNNER_VERSION
RUNNER_ARCHIVE_SHA256=$RUNNER_SHA256
SERVICE_USER=$RUNNER_USER
DOCKER_ACCESS=true
REGISTERED_UTC=$now
TOKEN_STORED=false
EOF
sha256sum "$evidence" > "$evidence.sha256"
chmod 600 "$evidence" "$evidence.sha256"

echo "[PASS] IZAKHONO Actions runner is online for $REPO_URL."
echo "Runner labels: self-hosted, linux, x64, $RUNNER_LABELS"
echo "Evidence: $evidence"
echo 'The short-lived registration token was not written to the evidence file.'
