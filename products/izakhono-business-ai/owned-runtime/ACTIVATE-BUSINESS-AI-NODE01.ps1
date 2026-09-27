$ErrorActionPreference = "Stop"
$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $AppDir

Write-Host "[1/5] Building IZAKHONO BUSINESS AI owned runtime..."
docker compose build --pull

Write-Host "[2/5] Starting container..."
docker compose up -d

Write-Host "[3/5] Waiting for local health..."
$ok = $false
for ($i=0; $i -lt 30; $i++) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8787/health" -TimeoutSec 5
    if ($r.StatusCode -eq 200 -and $r.Content -match '"ok":true') { $ok = $true; break }
  } catch {}
  Start-Sleep -Seconds 2
}
if (-not $ok) {
  docker compose ps
  docker compose logs --tail=120
  throw "Health gate failed."
}

Write-Host "[4/5] Confirming UI identity..."
$root = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8787/" -TimeoutSec 5
if ($root.StatusCode -ne 200 -or $root.Content -notmatch "IZAKHONO BUSINESS AI") {
  throw "UI identity gate failed."
}

Write-Host "[5/5] Owned runtime ready locally."
Write-Host "NEXT: route businessai.izakhono.co.za through IZAKHONO EDGE/TLS to 127.0.0.1:8787"
Write-Host "Then run: node acceptance.mjs https://businessai.izakhono.co.za"
