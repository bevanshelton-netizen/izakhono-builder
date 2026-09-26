#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Hostname = 'nav.izakhonoafrica.co.za'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

if($Hostname -notmatch '^(?=.{4,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$'){
  throw "Invalid hostname: $Hostname"
}

$local='http://127.0.0.1:8787'
try {
  $home=Invoke-WebRequest -Uri "$local/" -UseBasicParsing -TimeoutSec 8
  if($home.Content -notmatch 'IZAKHONO NAV'){ throw 'Unexpected local NAV page.' }
  $health=Invoke-RestMethod -Uri "$local/api/health" -TimeoutSec 8
  if($health.routing -ne 'ready' -or $health.search -ne 'ready' -or $health.tiles -ne 'ready' -or $health.node01Required -ne $false){
    throw 'NAV owned dependencies are not fully ready.'
  }
} catch { throw "Private NAV gateway is not ready: $($_.Exception.Message)" }

$generated=Join-Path $PSScriptRoot 'generated'
New-Item -ItemType Directory -Force -Path $generated | Out-Null
$path=Join-Path $generated '25-izakhono-nav.caddy'
$body=@"
$Hostname {
  encode zstd gzip
  reverse_proxy host.docker.internal:8787
}
"@
Set-Content -Path $path -Value $body -Encoding UTF8
Write-Host "[STAGED] $path"
Write-Host "[PASS] NAV EDGE route staged for $Hostname." -ForegroundColor Green
Write-Host 'No live EDGE file was changed. DNS/TLS/public reachability are not implied.'
