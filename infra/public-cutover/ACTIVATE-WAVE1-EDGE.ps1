#requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$generated=Join-Path $PSScriptRoot 'generated'
$sites=Join-Path $root 'infra\launch-stack\sites'
$compose=Join-Path $root 'infra\launch-stack\docker-compose.yml'

$expected=@(
  @{File='20-allegro-vibez.caddy'; Local='http://127.0.0.1:8080/healthz'},
  @{File='20-the-chancellor.caddy'; Local='http://127.0.0.1:3000/api/health'}
)

foreach($item in $expected){
  $src=Join-Path $generated $item.File
  if(-not (Test-Path $src)){ throw "Missing staged EDGE file: $src" }
  try { Invoke-WebRequest -Uri $item.Local -UseBasicParsing -TimeoutSec 8 | Out-Null }
  catch { throw "NODE01 local health failed: $($item.Local)" }
}

if(-not $Apply){
  Write-Host '[DRY RUN PASS] Staged files exist and NODE01 services are healthy.' -ForegroundColor Green
  Write-Host 'Run again with -Apply only after the hostname/DNS plan has been reviewed.'
  exit 0
}

foreach($item in $expected){
  Copy-Item -Force (Join-Path $generated $item.File) (Join-Path $sites $item.File)
}

docker compose -f $compose config | Out-Null
if($LASTEXITCODE -ne 0){ throw 'Caddy stack compose validation failed.' }

docker compose -f $compose up -d caddy
if($LASTEXITCODE -ne 0){ throw 'Could not start/update IZAKHONO Caddy.' }

docker compose -f $compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile
if($LASTEXITCODE -ne 0){ throw 'Caddy configuration validation failed.' }

docker compose -f $compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
if($LASTEXITCODE -ne 0){ throw 'Caddy reload failed.' }

Write-Host '[EDGE ACTIVE] Caddy routes have been loaded.' -ForegroundColor Green
Write-Host 'This does NOT prove DNS/TLS/public reachability. Run VERIFY-WAVE1-PUBLIC.ps1 next.'
