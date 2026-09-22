#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$AllegroHostname,
  [Parameter(Mandatory=$true)][string]$ChancellorHostname
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

function Assert-Hostname([string]$Value) {
  if ($Value -notmatch '^(?=.{4,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$') {
    throw "Invalid hostname: $Value"
  }
}

Assert-Hostname $AllegroHostname
Assert-Hostname $ChancellorHostname

$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$generated=Join-Path $PSScriptRoot 'generated'
New-Item -ItemType Directory -Force -Path $generated | Out-Null

$items=@(
  @{Slug='allegro-vibez'; Host=$AllegroHostname; Upstream='host.docker.internal:8080'; Health='/healthz'},
  @{Slug='the-chancellor'; Host=$ChancellorHostname; Upstream='host.docker.internal:3000'; Health='/api/health'}
)

foreach($item in $items){
  $local="http://127.0.0.1:$($item.Upstream.Split(':')[-1])$($item.Health)"
  try { Invoke-WebRequest -Uri $local -UseBasicParsing -TimeoutSec 8 | Out-Null }
  catch { throw "Local NODE01 health failed for $($item.Slug): $local" }

  $body=@"
$($item.Host) {
  encode zstd gzip
  reverse_proxy $($item.Upstream)
}
"@
  $path=Join-Path $generated ("20-"+$item.Slug+".caddy")
  Set-Content -Path $path -Value $body -Encoding UTF8
  Write-Host "[STAGED] $path"
}

Write-Host ''
Write-Host '[PASS] EDGE snippets staged only.' -ForegroundColor Green
Write-Host 'Nothing was copied into the live Caddy sites directory and no DNS was changed.'
Write-Host 'Point the approved DNS hostnames to the owned EDGE, then activate/reload Caddy and run VERIFY-WAVE1-PUBLIC.ps1.'
