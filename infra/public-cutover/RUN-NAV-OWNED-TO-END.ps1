#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Distro='Ubuntu-24.04',
  [string]$Hostname='nav.izakhonoafrica.co.za',
  [switch]$ApplyEdge
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

$nodeDir=(Resolve-Path (Join-Path $PSScriptRoot '..\..\products\izakhono-node')).Path
& (Join-Path $nodeDir 'START-IZAKHONO-NAV.ps1') -Distro $Distro
if($LASTEXITCODE -ne 0){ throw 'NAV owner-host activation failed.' }

& (Join-Path $PSScriptRoot 'STAGE-NAV-EDGE.ps1') -Hostname $Hostname
if($ApplyEdge){
  & (Join-Path $PSScriptRoot 'ACTIVATE-NAV-EDGE.ps1') -Apply
  & (Join-Path $PSScriptRoot 'VERIFY-NAV-PUBLIC.ps1') -Hostname $Hostname
}else{
  & (Join-Path $PSScriptRoot 'ACTIVATE-NAV-EDGE.ps1')
  Write-Host ''
  Write-Host '[LOCAL END-STATE COMPLETE]' -ForegroundColor Green
  Write-Host 'NAV is owned-stack ready and the public EDGE route is staged.'
  Write-Host 'Public activation was not applied because -ApplyEdge was not supplied.'
}
