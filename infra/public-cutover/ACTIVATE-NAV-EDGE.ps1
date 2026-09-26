#requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$Apply
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$generated=Join-Path $PSScriptRoot 'generated'
$src=Join-Path $generated '25-izakhono-nav.caddy'
$sites=Join-Path $root 'infra\launch-stack\sites'
$compose=Join-Path $root 'infra\launch-stack\docker-compose.yml'
$local='http://127.0.0.1:8787'

if(-not (Test-Path $src)){ throw "Missing staged NAV EDGE file: $src" }
try {
  $health=Invoke-RestMethod -Uri "$local/api/health" -TimeoutSec 8
  if($health.routing -ne 'ready' -or $health.search -ne 'ready' -or $health.tiles -ne 'ready'){ throw 'Owned dependencies are not ready.' }
} catch { throw "NAV local health failed: $($_.Exception.Message)" }

if(-not $Apply){
  Write-Host '[DRY RUN PASS] NAV is locally healthy and its shared EDGE route is staged.' -ForegroundColor Green
  Write-Host 'Run again with -Apply only when DNS for the NAV hostname points to the owner-controlled EDGE.'
  exit 0
}

Copy-Item -Force $src (Join-Path $sites '25-izakhono-nav.caddy')
docker compose -f $compose config | Out-Null
if($LASTEXITCODE -ne 0){ throw 'IZAKHONO EDGE compose validation failed.' }
docker compose -f $compose up -d caddy
if($LASTEXITCODE -ne 0){ throw 'Could not start/update IZAKHONO EDGE.' }
docker compose -f $compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile
if($LASTEXITCODE -ne 0){ throw 'Caddy validation failed.' }
docker compose -f $compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
if($LASTEXITCODE -ne 0){ throw 'Caddy reload failed.' }

Write-Host '[EDGE ACTIVE] NAV route loaded into shared IZAKHONO EDGE.' -ForegroundColor Green
Write-Host 'This is not yet public verification. Run VERIFY-NAV-PUBLIC.ps1.'
