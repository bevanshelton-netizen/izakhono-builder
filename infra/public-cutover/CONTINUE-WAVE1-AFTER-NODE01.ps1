#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$AllegroHostname,
  [Parameter(Mandatory=$true)][string]$ChancellorHostname,
  [string]$NodeReport = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'IZAKHONO-NODE01-WAVE1-REPORT.json'),
  [switch]$ApplyEdge
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

function Assert-LocalProof([string]$Path) {
  if(-not (Test-Path $Path)){ throw "Missing NODE01 Wave 1 report: $Path" }
  $report=Get-Content $Path -Raw | ConvertFrom-Json

  if($report.schema -ne 'izakhono.node01.wave1.report.v1'){
    throw "Unexpected NODE01 Wave 1 report schema: $($report.schema)"
  }
  if($report.overall -ne 'PASS_LOCAL_OWNED'){
    throw "NODE01 local owned proof has not passed. External production remains authoritative."
  }
  if([bool]$report.public_cutover_performed){
    throw "Unexpected report state: local proof must not claim a public cutover."
  }

  foreach($slug in @('allegro-vibez','the-chancellor')){
    $app=$report.apps | Where-Object {$_.slug -eq $slug}
    if(-not $app){ throw "NODE01 report is missing $slug." }
    if($app.result -ne 'local_owned_deployment_verified'){
      throw "NODE01 local proof did not verify $slug."
    }
    if(-not [bool]$app.postcheck_local_health.ok){
      throw "NODE01 post-deploy health is not passing for $slug."
    }
  }
}

Assert-LocalProof $NodeReport

$stage=Join-Path $PSScriptRoot 'STAGE-WAVE1-EDGE.ps1'
$activate=Join-Path $PSScriptRoot 'ACTIVATE-WAVE1-EDGE.ps1'
$verify=Join-Path $PSScriptRoot 'VERIFY-WAVE1-PUBLIC.ps1'

foreach($script in @($stage,$activate,$verify)){
  if(-not (Test-Path $script)){ throw "Missing required Wave 1 script: $script" }
}

Write-Host '[PASS] NODE01 local owned report accepted.' -ForegroundColor Green
Write-Host '[1/3] Staging EDGE routes...'
& $stage -AllegroHostname $AllegroHostname -ChancellorHostname $ChancellorHostname
if($LASTEXITCODE -ne 0){ throw 'Wave 1 EDGE staging failed.' }

Write-Host '[2/3] Running EDGE dry-run...'
& $activate
if($LASTEXITCODE -ne 0){ throw 'Wave 1 EDGE dry-run failed.' }

if(-not $ApplyEdge){
  Write-Host ''
  Write-Host '[HOLD] No live EDGE change was made.' -ForegroundColor Yellow
  Write-Host 'Confirm the approved DNS records for both hostnames point to the owned EDGE.'
  Write-Host 'Then rerun this command with --apply-edge to activate Caddy and run the public DNS/TLS/HTTPS acceptance gate.'
  exit 0
}

Write-Host '[2/3] Activating reviewed EDGE routes...'
& $activate -Apply
if($LASTEXITCODE -ne 0){ throw 'Wave 1 EDGE activation failed. Keep the external routes authoritative.' }

Write-Host '[3/3] Running public DNS/TLS/HTTPS acceptance...'
& $verify -AllegroHostname $AllegroHostname -ChancellorHostname $ChancellorHostname
if($LASTEXITCODE -ne 0){
  throw 'Public acceptance did not pass. Keep or revert to the verified external production routes.'
}

Write-Host ''
Write-Host '[PASS] Wave 1 public acceptance gates passed.' -ForegroundColor Green
Write-Host 'External fallbacks were not removed.'
Write-Host 'Review IZAKHONO-WAVE1-PUBLIC-VERIFY.json before promoting either platform to OWNED LIVE VERIFIED.'
