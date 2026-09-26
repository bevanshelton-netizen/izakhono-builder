#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Hostname = 'venture.izakhono.co.za'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Hostname -notmatch '^(?=.{4,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$') {
  throw "Invalid hostname: $Hostname"
}

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$generated = Join-Path $PSScriptRoot 'generated'
New-Item -ItemType Directory -Force -Path $generated | Out-Null

$local = 'http://127.0.0.1:9780/healthz'
try {
  $health = Invoke-RestMethod -Uri $local -TimeoutSec 8
  if (-not $health.ok) { throw 'health endpoint returned ok=false' }
} catch {
  throw "Venture Factory NODE01 health failed: $local — $($_.Exception.Message)"
}

$body = @"
$Hostname {
  encode zstd gzip

  @health path /healthz
  handle @health {
    reverse_proxy host.docker.internal:9780
  }

  handle {
    reverse_proxy host.docker.internal:9780
  }
}
"@

$path = Join-Path $generated '30-venture-factory.caddy'
Set-Content -Path $path -Value $body -Encoding UTF8

Write-Host '[PASS] Venture Factory EDGE route staged.' -ForegroundColor Green
Write-Host ('Hostname: ' + $Hostname)
Write-Host ('Staged file: ' + $path)
Write-Host 'No live EDGE or DNS changes were made.'
