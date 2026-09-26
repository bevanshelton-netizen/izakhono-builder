#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Distro = 'Ubuntu'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Quote-Argument([string]$Value) {
    return '"' + ($Value -replace '"', '\"') + '"'
}

function Ensure-Admin {
    if (Test-IsAdministrator) { return }
    $args = @('-NoProfile','-ExecutionPolicy','Bypass','-File',$PSCommandPath,'-Distro',$Distro)
    Start-Process -FilePath 'PowerShell.exe' -Verb RunAs -ArgumentList (($args | ForEach-Object { Quote-Argument $_ }) -join ' ')
    exit 0
}

function Invoke-Checked([string]$Label, [scriptblock]$Action) {
    Write-Host ''
    Write-Host "=== $Label ===" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "[FAIL] $Label stopped with exit code $LASTEXITCODE."
    }
}

Ensure-Admin

$ownerHost = Join-Path $PSScriptRoot 'windows-owner-host.ps1'
$runnerFleet = Join-Path $PSScriptRoot 'enable-actions-runner-fleet.ps1'
if (-not (Test-Path $ownerHost)) { throw '[FAIL] Owner-host installer is missing from this package.' }
if (-not (Test-Path $runnerFleet)) { throw '[FAIL] Runner-fleet installer is missing from this package.' }

Write-Host 'IZAKHONO NODE01 WAVE 1 RECOVERY' -ForegroundColor Green
Write-Host 'This refreshes owned infrastructure and runs local proof only. It does not change DNS, EDGE routes or public traffic.'

Invoke-Checked 'Refresh IZAKHONO owner host' {
    & PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File $ownerHost -Distro $Distro -NoRestart
}

Invoke-Checked 'Restore IZAKHONO runner fleet' {
    & PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File $runnerFleet -Distro $Distro
}

Invoke-Checked 'Verify hardened Wave 1 bridge and owned scheduler' {
    & wsl.exe -d $Distro -u root -- bash -lc @'
set -euo pipefail
test -x /opt/izakhono/bin/run-wave1-local-proof
systemctl is-active --quiet izakhono-node.service
systemctl is-active --quiet izakhono-control.service
systemctl is-enabled --quiet izakhono-wave1-watch.timer
systemctl is-active --quiet izakhono-wave1-watch.timer
systemctl is-enabled --quiet izakhono-runner-keepalive.timer
systemctl is-active --quiet izakhono-runner-keepalive.timer
systemctl is-enabled --quiet izakhono-wave1-request.timer
systemctl is-active --quiet izakhono-wave1-request.timer
sudo -l -U izakhono-runner | grep -F '/opt/izakhono/bin/run-wave1-local-proof' >/dev/null
'@
}

Write-Host ''
Write-Host '=== Run NODE01 Wave 1 local owned proof ===' -ForegroundColor Cyan
& wsl.exe -d $Distro -u root -- /opt/izakhono/bin/run-wave1-local-proof
$proofRc = $LASTEXITCODE

$reportJson = & wsl.exe -d $Distro -u root -- cat /opt/izakhono/evidence/IZAKHONO-NODE01-WAVE1-REPORT.json 2>$null
$reportText = ($reportJson -join [Environment]::NewLine).Trim()
if (-not $reportText) {
    throw '[FAIL] NODE01 proof did not produce its evidence report.'
}

$desktop = [Environment]::GetFolderPath('Desktop')
$reportPath = Join-Path $desktop 'IZAKHONO-NODE01-WAVE1-REPORT.json'
[IO.File]::WriteAllText($reportPath, $reportText + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

$statusLines = @()
$statusLines += "GENERATED_UTC=$([DateTime]::UtcNow.ToString('o'))"
$statusLines += "REPORT=$reportPath"
$statusLines += "LOCAL_PROOF_EXIT_CODE=$proofRc"
$statusLines += "NODE01_ACTIVE=true"
$statusLines += "CONTROL_ACTIVE=true"
$statusLines += "WAVE1_WATCH_TIMER_ACTIVE=true"
$statusLines += "RUNNER_KEEPALIVE_TIMER_ACTIVE=true"
$statusLines += "OWNED_WAVE1_REQUEST_TIMER_ACTIVE=true"
$statusLines += "RUNNER_FIXED_BRIDGE_AUTHORIZED=true"
$statusLines += "PUBLIC_CUTOVER_PERFORMED=false"
$statusLines += "EXTERNAL_FALLBACKS_PRESERVED=true"
$statusPath = Join-Path $desktop 'IZAKHONO-NODE01-RECOVERY-REPORT.txt'
[IO.File]::WriteAllLines($statusPath, $statusLines, [Text.UTF8Encoding]::new($false))

if ($proofRc -ne 0) {
    Write-Host ''
    Write-Host '[SAFE STOP] NODE01 recovered, but Wave 1 local proof did not pass.' -ForegroundColor Yellow
    Write-Host "Evidence: $reportPath"
    Write-Host 'No DNS, EDGE or public traffic change was made.'
    exit $proofRc
}

Write-Host ''
Write-Host '[PASS] NODE01 RECOVERED AND WAVE 1 LOCAL OWNED PROOF PASSED.' -ForegroundColor Green
Write-Host "Evidence: $reportPath"
Write-Host "Recovery report: $statusPath"
Write-Host 'Next gate remains EDGE -> DNS -> TLS -> independent public HTTPS verification -> rollback proof.'
