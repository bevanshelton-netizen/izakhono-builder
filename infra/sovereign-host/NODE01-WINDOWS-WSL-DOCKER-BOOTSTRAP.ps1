#requires -Version 5.1
[CmdletBinding()]
param([string]$Distro = 'Ubuntu-24.04')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Require($name) { if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { throw "[FAIL] $name is required." } }
Require 'wsl.exe'
Require 'docker'
$distros = @(wsl.exe -l -q 2>$null | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
if ($distros -notcontains $Distro) { if ($Distro -eq 'Ubuntu-24.04' -and $distros -contains 'Ubuntu') { $Distro = 'Ubuntu' } else { throw "[FAIL] WSL distro '$Distro' is not installed." } }
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw '[FAIL] Docker is not reachable. Start Docker and enable WSL integration.' }
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$linuxRoot = (wsl.exe -d $Distro -- wslpath -a "$root").Trim()
if (-not $linuxRoot) { throw '[FAIL] Could not map IZAKHONO source into WSL.' }
Write-Host 'IZAKHONO NODE01 — Windows + WSL + Docker bootstrap' -ForegroundColor Cyan
wsl.exe -d $Distro -u root -- bash "$linuxRoot/infra/sovereign-host/bootstrap-node01.sh"
if ($LASTEXITCODE -ne 0) { throw "[FAIL] WSL bootstrap failed with exit code $LASTEXITCODE." }
Write-Host '[PASS] NODE01 owner host bootstrap completed.' -ForegroundColor Green
