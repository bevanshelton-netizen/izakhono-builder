#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Hostname
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

function Assert-Hostname([string]$Value) {
  if ($Value -notmatch '^(?=.{4,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$') {
    throw "Invalid hostname: $Value"
  }
}
Assert-Hostname $Hostname

$ready='http://127.0.0.1:8787/api/ready'
try {
  $r=Invoke-RestMethod -Uri $ready -TimeoutSec 8
  if(-not $r.ok){ throw 'readiness response was not ok' }
  if($r.database -ne 'ready'){ throw "database=$($r.database)" }
  if(-not $r.owner_secret_configured){ throw 'owner secret is not configured' }
} catch {
  throw "DOCFLOW NODE01 readiness failed: $ready :: $($_.Exception.Message)"
}

$generated=Join-Path $PSScriptRoot 'generated'
New-Item -ItemType Directory -Force -Path $generated | Out-Null
$body=@"
$Hostname {
  encode zstd gzip
  reverse_proxy host.docker.internal:8787
}
"@
$path=Join-Path $generated '30-izakhono-docflow.caddy'
Set-Content -Path $path -Value $body -Encoding UTF8

Write-Host "[STAGED] $path" -ForegroundColor Green
Write-Host 'DOCFLOW NODE01 readiness passed.'
Write-Host 'No live Caddy file, DNS record, or public route was changed.'
