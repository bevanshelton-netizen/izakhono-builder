#!/usr/bin/env bash
set -euo pipefail

[[ ${EUID:-$(id -u)} -eq 0 ]] || { echo 'Run as root.' >&2; exit 1; }
for c in python3 docker curl systemctl; do
  command -v "$c" >/dev/null || { echo "Missing required command: $c" >&2; exit 20; }
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PRODUCT_DIR="$ROOT_DIR/products/izakhono-work"
MODEL="${IZAKHONO_WORK_MODEL:-qwen3:4b}"
OLLAMA_IMAGE="${IZAKHONO_OLLAMA_IMAGE:-ollama/ollama:latest}"

install -d -m 0755 /opt/izakhono-work /var/lib/izakhono-work /etc/izakhono
install -m 0755 "$PRODUCT_DIR/app.py" /opt/izakhono-work/app.py
install -m 0644 "$PRODUCT_DIR/builder_core.py" /opt/izakhono-work/builder_core.py
install -m 0644 "$PRODUCT_DIR/izakhono-work.service" /etc/systemd/system/izakhono-work.service

if [[ ! -f /etc/izakhono/work.env ]]; then
  umask 077
  cat > /etc/izakhono/work.env <<EOF
IZAKHONO_WORK_HOST=127.0.0.1
IZAKHONO_WORK_PORT=9393
IZAKHONO_WORK_TOKEN=
IZAKHONO_WORK_DATA=/var/lib/izakhono-work
IZAKHONO_OLLAMA_URL=http://127.0.0.1:11434
IZAKHONO_WORK_MODEL=$MODEL
EOF
fi
chmod 0600 /etc/izakhono/work.env

if ! docker inspect izakhono-ollama >/dev/null 2>&1; then
  docker volume create izakhono_ollama >/dev/null
  docker run -d \
    --name izakhono-ollama \
    --restart unless-stopped \
    -p 127.0.0.1:11434:11434 \
    -v izakhono_ollama:/root/.ollama \
    "$OLLAMA_IMAGE" >/dev/null
fi

ready=0
for _ in $(seq 1 60); do
  if curl -fsS --max-time 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
[[ "$ready" == 1 ]] || { echo 'Ollama runtime did not become healthy.' >&2; docker logs izakhono-ollama || true; exit 30; }

echo "Ensuring local model is available: $MODEL"
docker exec izakhono-ollama ollama pull "$MODEL"

systemctl daemon-reload
systemctl enable --now izakhono-work
curl -fsS --max-time 5 http://127.0.0.1:9393/healthz >/dev/null

printf 'IZAKHONO_WORK=READY\n'
printf 'Local workspace: http://127.0.0.1:9393\n'
printf 'Model: %s\n' "$MODEL"
printf 'Local owner mode has no bearer-token prompt because the service is bound to localhost only.\n'
printf 'No usage-credit gate is implemented. Capacity is bounded by owner hardware, storage and power.\n'
printf 'Add authenticated IZAKHONO edge access before allowing remote devices.\n'
