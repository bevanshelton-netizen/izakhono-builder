#requires -Version 5.1
[CmdletBinding()]
param([string]$Distro = 'Ubuntu-24.04')

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$distros = @(wsl.exe -l -q 2>$null | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
if ($distros -notcontains $Distro) {
    if ($Distro -eq 'Ubuntu-24.04' -and $distros -contains 'Ubuntu') { $Distro = 'Ubuntu' }
    else { throw '[FAIL] IZAKHONO owner host is not installed.' }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$linuxRoot = (& wsl.exe -d $Distro -- wslpath -a "$repoRoot").Trim()
if (-not $linuxRoot) { throw '[FAIL] Could not map the IZAKHONO repository into WSL.' }

$desktop = [Environment]::GetFolderPath('Desktop')
$report = Join-Path $desktop 'IZAKHONO-TASKS-FLOWIQ-NODE01-REPORT.txt'

Write-Host ''
Write-Host 'IZAKHONO TASKS + FLOWIQ — NODE01' -ForegroundColor Cyan
Write-Host 'Deploying TASKS and binding the internal workflow chain...'
Write-Host ''

& wsl.exe -d $Distro -u root -- bash "$linuxRoot/products/izakhono-tasks/owner-node/deploy-node01.sh" "$linuxRoot" 2>&1 |
    Tee-Object -FilePath $report
if ($LASTEXITCODE -ne 0) {
    throw "[FAIL] TASKS/FLOWIQ NODE01 deployment stopped. Report: $report"
}

Write-Host ''
Write-Host '[PASS] TASKS + FLOWIQ internal chain verified.' -ForegroundColor Green
Write-Host "Report: $report"
