#requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Hostname)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if($Hostname -notmatch '^(?=.{4,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$'){throw "Invalid hostname: $Hostname"}
try{$r=Invoke-RestMethod -Uri 'http://127.0.0.1:9898/readyz' -TimeoutSec 8;if(-not $r.ok){throw 'SIGN not ready'}}catch{throw "SIGN NODE01 readiness failed: $($_.Exception.Message)"}
$generated=Join-Path $PSScriptRoot 'generated';New-Item -ItemType Directory -Force -Path $generated|Out-Null
$body=@"
$Hostname {
  encode zstd gzip
  reverse_proxy host.docker.internal:9898
}
"@
$path=Join-Path $generated '40-izakhono-sign.caddy'
Set-Content -Path $path -Value $body -Encoding UTF8
Write-Host "[STAGED] $path" -ForegroundColor Green
Write-Host 'No live Caddy file or DNS record was changed.'
Write-Host "Before activation, configure SIGN_PUBLIC_BASE_URL=https://$Hostname with owner-node/set-public-base.sh."
