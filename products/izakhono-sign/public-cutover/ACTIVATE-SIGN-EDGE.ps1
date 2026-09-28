#requires -Version 5.1
[CmdletBinding()]
param([switch]$Apply)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$staged=Join-Path $PSScriptRoot 'generated\40-izakhono-sign.caddy'
$sites=Join-Path $root 'infra\launch-stack\sites'
$compose=Join-Path $root 'infra\launch-stack\docker-compose.yml'
if(-not (Test-Path $staged)){throw "Missing staged route: $staged"}
$r=Invoke-RestMethod -Uri 'http://127.0.0.1:9898/readyz' -TimeoutSec 8
if(-not $r.ok -or -not $r.public_route_configured){throw 'SIGN must be ready with SIGN_PUBLIC_BASE_URL configured before EDGE activation.'}
if(-not $Apply){Write-Host '[DRY RUN PASS] SIGN route staged; runtime public base configured.' -ForegroundColor Green;exit 0}
Copy-Item -Force $staged (Join-Path $sites '40-izakhono-sign.caddy')
docker compose -f $compose config|Out-Null
if($LASTEXITCODE -ne 0){throw 'Compose validation failed.'}
docker compose -f $compose up -d caddy
if($LASTEXITCODE -ne 0){throw 'Caddy start/update failed.'}
docker compose -f $compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile
if($LASTEXITCODE -ne 0){throw 'Caddy validation failed.'}
docker compose -f $compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
if($LASTEXITCODE -ne 0){throw 'Caddy reload failed.'}
Write-Host '[EDGE ACTIVE LOCALLY] SIGN route loaded. Public DNS/TLS must still be verified.' -ForegroundColor Green
