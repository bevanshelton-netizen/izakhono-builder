#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$FallbackReport = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'IZAKHONO-WAVE2-EXTERNAL-FALLBACK-REPORT.json')
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

if(-not (Test-Path $FallbackReport)){ throw "Missing Wave 2 external fallback report: $FallbackReport" }
$report=Get-Content $FallbackReport -Raw | ConvertFrom-Json
if($report.overall -ne 'REACHABILITY_PASS_REQUIRES_OWNER_CLASSIFICATION'){
  throw "Wave 2 fallback reachability has not passed. NODE01 deployment remains blocked."
}

$ecd=$report.results | Where-Object {$_.name -eq 'edubuild-ecd360'}
$legacy=$report.results | Where-Object {$_.name -eq 'legacymart'}
if(-not ($ecd.qualifies -and $legacy.qualifies)){ throw 'Both external fallback candidates must be reachable.' }

Write-Host '[PASS] Wave 2 external routes are reachable.' -ForegroundColor Green
Write-Host '[HOLD] This is NOT authorization to deploy or cut over.'
Write-Host 'ECD360 is still classified as staging/emergency-bridge candidate; owner/product readiness classification is still required.'
Write-Host 'LegacyMart still requires checkout/payment and seller-money boundaries to remain safe before public production.'
Write-Host 'Immutable NODE01 profiles are prepared under products/izakhono-node/profiles/wave2/.'
