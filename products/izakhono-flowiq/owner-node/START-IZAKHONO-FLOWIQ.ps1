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
$report = Join-Path $desktop 'IZAKHONO-FLOWIQ-NODE01-REPORT.txt'

Write-Host ''
Write-Host 'IZAKHONO FLOWIQ — NODE01' -ForegroundColor Cyan
Write-Host 'Preparing local credentials, syncing to IZAKHONO CODE and deploying through CONTROL -> NODE...'
Write-Host ''

& wsl.exe -d $Distro -u root -- bash "$linuxRoot/products/izakhono-flowiq/owner-node/deploy-node01.sh" "$linuxRoot" 2>&1 |
    Tee-Object -FilePath $report
if ($LASTEXITCODE -ne 0) {
    throw "[FAIL] FLOWIQ NODE01 deployment stopped. Report: $report"
}

Write-Host ''
Write-Host '[PASS] FLOWIQ NODE01 local deployment verified.' -ForegroundColor Green
Write-Host "Report: $report"
