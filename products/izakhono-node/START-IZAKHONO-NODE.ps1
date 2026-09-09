#requires -Version 5.1
[CmdletBinding()]
param([string]$Distro = 'Ubuntu')

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$distros = @(wsl.exe -l -q 2>$null | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
if ($distros -notcontains $Distro) {
    throw '[FAIL] IZAKHONO owner host is not installed. Run START-IZAKHONO-OWNER-HOST.cmd first.'
}

$windowsProduct = (Resolve-Path $PSScriptRoot).Path
$linuxProduct = (& wsl.exe -d $Distro -- wslpath -a "$windowsProduct").Trim()
if (-not $linuxProduct) {
    throw '[FAIL] Could not map the IZAKHONO Node product folder into WSL.'
}

Write-Host ''
Write-Host 'IZAKHONO NODE 01' -ForegroundColor Cyan
Write-Host 'Installing NODE + CONTROL on our owner host...'
Write-Host ''

& wsl.exe -d $Distro -u root -- bash "$linuxProduct/install.sh"
if ($LASTEXITCODE -ne 0) {
    throw "[FAIL] IZAKHONO Node installer stopped with exit code $LASTEXITCODE."
}

Write-Host ''
Write-Host '[PASS] IZAKHONO NODE 01 activation completed.' -ForegroundColor Green
Write-Host 'No GitHub runner registration token was required.'
