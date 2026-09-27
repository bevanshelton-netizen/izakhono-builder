#requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$generated=Join-Path $PSScriptRoot 'generated'
$staged=Join-Path $generated '30-izakhono-docflow.caddy'
$sites=Join-Path $root 'infra\launch-stack\sites'
$compose=Join-Path $root 'infra\launch-stack\docker-compose.yml'
$ready='http://127.0.0.1:8787/api/ready'

if(-not (Test-Path $staged)){ throw "Missing staged EDGE file: $staged" }
try {
  $r=Invoke-RestMethod -Uri $ready -TimeoutSec 8
  if(-not $r.ok -or $r.database -ne 'ready' -or -not $r.owner_secret_configured){
    throw 'DOCFLOW readiness contract is incomplete'
  }
} catch {
  throw "DOCFLOW NODE01 readiness failed: $($_.Exception.Message)"
}

if(-not $Apply){
  Write-Host '[DRY RUN PASS] DOCFLOW route is staged and NODE01 is ready.' -ForegroundColor Green
  Write-Host 'Run again with -Apply only after the chosen hostname and DNS plan are approved.'
  exit 0
}

Copy-Item -Force $staged (Join-Path $sites '30-izakhono-docflow.caddy')

docker compose -f $compose config | Out-Null
if($LASTEXITCODE -ne 0){ throw 'Caddy stack compose validation failed.' }

docker compose -f $compose up -d caddy
if($LASTEXITCODE -ne 0){ throw 'Could not start/update IZAKHONO Caddy.' }

docker compose -f $compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile
if($LASTEXITCODE -ne 0){ throw 'Caddy configuration validation failed.' }

docker compose -f $compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
if($LASTEXITCODE -ne 0){ throw 'Caddy reload failed.' }

Write-Host '[EDGE ACTIVE LOCALLY] DOCFLOW Caddy route loaded.' -ForegroundColor Green
Write-Host 'This is not proof of public DNS/TLS. Run VERIFY-DOCFLOW-PUBLIC.ps1 after DNS is pointed at the owned EDGE.'
