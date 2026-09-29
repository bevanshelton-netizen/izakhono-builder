$ErrorActionPreference = "Stop"
$Repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$Product = Join-Path $Repo "products\izakhono-growth-engine"
if (-not (Test-Path $Product)) { throw "Growth Engine package not found: $Product" }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker is required on NODE01." }

$EnvFile = "C:\ProgramData\Izakhono\growth-engine.env"
if (-not (Test-Path $EnvFile)) {
  throw "Missing $EnvFile. Configure GROWTH_ADMIN_TOKEN, CRM_URL and CRM_INGEST_TOKEN before activation."
}

docker build -t izakhono/growth-engine:0.1.0 $Product
docker rm -f izakhono-growth-engine 2>$null | Out-Null
docker run -d --name izakhono-growth-engine --restart unless-stopped --env-file $EnvFile -p 127.0.0.1:8096:8096 -v izakhono-growth-data:/data izakhono/growth-engine:0.1.0 | Out-Null

Start-Sleep -Seconds 3
$health = Invoke-RestMethod -Uri "http://127.0.0.1:8096/health" -TimeoutSec 10
if (-not $health.ok) { throw "Growth Engine health check failed." }
Write-Host "IZAKHONO Growth Engine is healthy on NODE01 loopback :8096"
Write-Host "Public LIVE status is NOT implied. EDGE/TLS/DNS and external HTTPS verification remain required."
