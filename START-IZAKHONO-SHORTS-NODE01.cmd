@echo off
setlocal
cd /d "%~dp0apps\izakhono-shorts"
docker volume create izakhono-shorts-jobs >nul 2>&1
docker build -t izakhono-shorts . || exit /b 1
docker rm -f izakhono-shorts-api >nul 2>&1
docker rm -f izakhono-shorts-worker >nul 2>&1
docker run -d --name izakhono-shorts-api --restart unless-stopped -p 9710:9710 -e IZAKHONO_SHORTS_RENDER_URL=http://host.docker.internal:9721 -v izakhono-shorts-jobs:/app/data/jobs izakhono-shorts || exit /b 1
docker run -d --name izakhono-shorts-worker --restart unless-stopped -e IZAKHONO_SHORTS_RENDER_URL=http://host.docker.internal:9721 -v izakhono-shorts-jobs:/app/data/jobs izakhono-shorts python worker.py || exit /b 1
echo IZAKHONO SHORTS FACTORY started on http://127.0.0.1:9710
endlocal
