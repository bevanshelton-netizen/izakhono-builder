#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Distro = 'Ubuntu-24.04'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$distros = @(wsl.exe -l -q 2>$null | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
if ($distros -notcontains $Distro) {
  if ($Distro -eq 'Ubuntu-24.04' -and $distros -contains 'Ubuntu') { $Distro='Ubuntu' }
  else { throw '[FAIL] IZAKHONO owner-host Ubuntu/WSL is not installed.' }
}
$product=(Resolve-Path $PSScriptRoot).Path
$linux=(& wsl.exe -d $Distro -- wslpath -a "$product").Trim()
if(-not $linux){ throw '[FAIL] Could not map IZAKHONO NODE folder into WSL.' }

Write-Host ''
Write-Host 'IZAKHONO NAV — OWNED ACTIVATION' -ForegroundColor Cyan
Write-Host 'Internal-first • immutable release • signed NODE promotion'
Write-Host ''
& wsl.exe -d $Distro -u root -- bash "$linux/deploy-nav-owned.sh"
if($LASTEXITCODE -ne 0){ throw "[FAIL] NAV activation stopped with exit code $LASTEXITCODE." }
Write-Host ''
Write-Host '[PASS] NAV owned stack activation completed.' -ForegroundColor Green
Write-Host 'Run the NAV EDGE stage/verification only after DNS points to the owner-controlled EDGE.'
