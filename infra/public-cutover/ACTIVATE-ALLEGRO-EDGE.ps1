#requires -Version 5.1
[CmdletBinding()]
param([switch]$Apply)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$generated=Join-Path $PSScriptRoot 'generated'
$sites=Join-Path $root 'infra\launch-stack\sites'
$compose=Join-Path $root 'infra\launch-stack\docker-compose.yml'
$src=Join-Path $generated '20-allegro-vibez.caddy'
$dest=Join-Path $sites '20-allegro-vibez.caddy'
$local='http://127.0.0.1:8080/healthz'

if(-not (Test-Path $src)){ throw "Missing staged ALLEGRO EDGE file: $src" }
try { Invoke-WebRequest -Uri $local -UseBasicParsing -TimeoutSec 8 | Out-Null }
catch { throw "ALLEGRO NODE01 local health failed: $local" }

if(-not $Apply){
  Write-Host '[DRY RUN PASS] ALLEGRO staged EDGE route exists and local health passes.' -ForegroundColor Green
  Write-Host 'No live Caddy route was changed.'
  exit 0
}

$backup=$null
if(Test-Path $dest){
  $backup=$dest+'.pre-allegro-cutover'
  Copy-Item -Force $dest $backup
}

try {
  Copy-Item -Force $src $dest
  docker compose -f $compose config | Out-Null
  if($LASTEXITCODE -ne 0){ throw 'Launch Stack compose validation failed.' }

  docker compose -f $compose up -d caddy
  if($LASTEXITCODE -ne 0){ throw 'Could not start/update IZAKHONO Caddy.' }

  docker compose -f $compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile
  if($LASTEXITCODE -ne 0){ throw 'Caddy configuration validation failed.' }

  docker compose -f $compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
  if($LASTEXITCODE -ne 0){ throw 'Caddy reload failed.' }
}
catch {
  if($backup -and (Test-Path $backup)){ Copy-Item -Force $backup $dest }
  elseif(Test-Path $dest){ Remove-Item -Force $dest }
  try { docker compose -f $compose up -d caddy | Out-Null } catch {}
  try { docker compose -f $compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile | Out-Null } catch {}
  throw
}

if($backup -and (Test-Path $backup)){ Remove-Item -Force $backup }
Write-Host '[EDGE ACTIVE] ALLEGRO route loaded into owned Caddy.' -ForegroundColor Green
Write-Host 'This does not claim public DNS/TLS success.'
