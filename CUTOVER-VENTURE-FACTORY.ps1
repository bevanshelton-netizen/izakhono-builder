#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Hostname = 'venture.izakhono.co.za',
  [switch]$ApplyEdge
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path $PSScriptRoot).Path

Write-Host '[1/4] Deploying/validating Venture Factory on NODE01...' -ForegroundColor Cyan
& (Join-Path $root 'START-VENTURE-FACTORY-NODE01.ps1')
if ($LASTEXITCODE -ne 0) { throw 'Venture Factory NODE01 deployment failed.' }

Write-Host '[2/4] Staging EDGE route...' -ForegroundColor Cyan
& (Join-Path $root 'infra\public-cutover\STAGE-VENTURE-FACTORY-EDGE.ps1') -Hostname $Hostname
if ($LASTEXITCODE -ne 0) { throw 'EDGE staging failed.' }

Write-Host '[3/4] EDGE activation gate...' -ForegroundColor Cyan
if ($ApplyEdge) {
  & (Join-Path $root 'infra\public-cutover\ACTIVATE-VENTURE-FACTORY-EDGE.ps1') -Apply
  if ($LASTEXITCODE -ne 0) { throw 'EDGE activation failed.' }
} else {
  & (Join-Path $root 'infra\public-cutover\ACTIVATE-VENTURE-FACTORY-EDGE.ps1')
  Write-Host '[HOLD] EDGE was not applied. Point DNS to the owned EDGE and rerun with -ApplyEdge.' -ForegroundColor Yellow
}

Write-Host '[4/4] Public verification...' -ForegroundColor Cyan
if ($ApplyEdge) {
  & (Join-Path $root 'infra\public-cutover\VERIFY-VENTURE-FACTORY-PUBLIC.ps1') -Hostname $Hostname
} else {
  Write-Host 'Public verification deferred until EDGE activation and DNS are ready.'
}
