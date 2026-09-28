#requires -Version 5.1
[CmdletBinding()]
param([string]$Distro='Ubuntu-24.04')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$distros=@(wsl.exe -l -q 2>$null | ForEach-Object { ($_ -replace "`0",'').Trim() } | Where-Object { $_ })
if($distros -notcontains $Distro){ if($Distro -eq 'Ubuntu-24.04' -and $distros -contains 'Ubuntu'){$Distro='Ubuntu'} else {throw '[FAIL] IZAKHONO owner host is not installed.'} }
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$linuxRoot=(& wsl.exe -d $Distro -- wslpath -a "$repoRoot").Trim()
if(-not $linuxRoot){throw '[FAIL] Could not map repository into WSL.'}
$report=Join-Path ([Environment]::GetFolderPath('Desktop')) 'IZAKHONO-DOCFLOW-CRM-SIGN-NODE01-REPORT.txt'
Write-Host 'IZAKHONO DOCFLOW + FLOWIQ + CRM + SIGN — NODE01' -ForegroundColor Cyan
& wsl.exe -d $Distro -u root -- bash "$linuxRoot/products/izakhono-sign/owner-node/deploy-docflow-chain.sh" "$linuxRoot" 2>&1 | Tee-Object -FilePath $report
if($LASTEXITCODE -ne 0){throw "[FAIL] Workflow-chain deployment stopped. Report: $report"}
Write-Host '[PASS] Internal document workflow chain verified.' -ForegroundColor Green
Write-Host "Report: $report"
Write-Host 'Public signing hostname and outbound mail are not claimed active.'
