#requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$generated = Join-Path $PSScriptRoot 'generated'
$sites = Join-Path $root 'infra\launch-stack\sites'
$compose = Join-Path $root 'infra\launch-stack\docker-compose.yml'
$src = Join-Path $generated '30-venture-factory.caddy'
$dst = Join-Path $sites '30-venture-factory.caddy'

if (-not (Test-Path $src)) { throw "Missing staged EDGE file: $src" }

try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:9780/healthz' -TimeoutSec 8
  if (-not $health.ok) { throw 'health endpoint returned ok=false' }
} catch {
  throw "Venture Factory local health is not verified: $($_.Exception.Message)"
}

if (-not $Apply) {
  Write-Host '[DRY RUN PASS] Staged EDGE file exists and Venture Factory local health is good.' -ForegroundColor Green
  Write-Host 'Run again with -Apply only after DNS is pointed at the intended IZAKHONO-owned EDGE.'
  exit 0
}

Copy-Item -Force $src $dst

docker compose -f $compose config | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'IZAKHONO Launch Stack compose validation failed.' }

docker compose -f $compose up -d caddy
if ($LASTEXITCODE -ne 0) { throw 'Could not start/update IZAKHONO Caddy.' }

docker compose -f $compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile
if ($LASTEXITCODE -ne 0) { throw 'Caddy configuration validation failed.' }

docker compose -f $compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
if ($LASTEXITCODE -ne 0) { throw 'Caddy reload failed.' }

Write-Host '[EDGE ACTIVE] Venture Factory Caddy route loaded.' -ForegroundColor Green
Write-Host 'This proves configuration activation only. It does not prove public DNS/TLS reachability.'
Write-Host 'Run VERIFY-VENTURE-FACTORY-PUBLIC.ps1 next.'
