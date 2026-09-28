#requires -Version 5.1
[CmdletBinding()]
param([string]$Distro='Ubuntu-24.04')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$distros=@(wsl.exe -l -q 2>$null | ForEach-Object { ($_ -replace "`0",'').Trim() } | Where-Object { $_ })
if($distros -notcontains $Distro){if($Distro -eq 'Ubuntu-24.04' -and $distros -contains 'Ubuntu'){$Distro='Ubuntu'}else{throw '[FAIL] IZAKHONO owner host is not installed.'}}
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$linuxRoot=(& wsl.exe -d $Distro -- wslpath -a "$repoRoot").Trim()
$report=Join-Path ([Environment]::GetFolderPath('Desktop')) 'IZAKHONO-MAIL-SIGN-NODE01-REPORT.txt'
& wsl.exe -d $Distro -u root -- bash "$linuxRoot/products/izakhono-mail/owner-node/deploy-mail-sign.sh" "$linuxRoot" 2>&1 | Tee-Object -FilePath $report
if($LASTEXITCODE -ne 0){throw "[FAIL] MAIL/SIGN deployment stopped. Report: $report"}
Write-Host '[PASS] MAIL is bound into SIGN.' -ForegroundColor Green
Write-Host "Report: $report"
