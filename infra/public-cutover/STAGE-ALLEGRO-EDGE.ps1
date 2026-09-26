#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$AllegroHostname = 'allegro.izakhonoafrica.co.za'
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

if ($AllegroHostname -notmatch '^(?=.{4,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$') {
  throw "Invalid hostname: $AllegroHostname"
}

$generated=Join-Path $PSScriptRoot 'generated'
New-Item -ItemType Directory -Force -Path $generated | Out-Null
$local='http://127.0.0.1:8080/healthz'

try { Invoke-WebRequest -Uri $local -UseBasicParsing -TimeoutSec 8 | Out-Null }
catch { throw "ALLEGRO NODE01 local health failed: $local" }

$body=@"
$AllegroHostname {
  encode zstd gzip
  reverse_proxy host.docker.internal:8080
}
"@
$path=Join-Path $generated '20-allegro-vibez.caddy'
Set-Content -Path $path -Value $body -Encoding UTF8

Write-Host "[STAGED] $path" -ForegroundColor Green
Write-Host 'No live Caddy route or DNS record was changed.'
