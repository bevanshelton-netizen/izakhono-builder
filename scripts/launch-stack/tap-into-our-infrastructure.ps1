#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Distro = 'Ubuntu',
    [switch]$Resume
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$TaskName = 'IZAKHONO Stage First Revenue App'

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Quote-Argument([string]$Value) {
    return '"' + ($Value -replace '"', '""') + '"'
}

function Ensure-Admin {
    if (Test-IsAdministrator) { return }
    Write-Host 'Requesting Windows administrator approval for our IZAKHONO infrastructure...'
    $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-Distro', $Distro)
    if ($Resume) { $args += '-Resume' }
    Start-Process -FilePath 'PowerShell.exe' -Verb RunAs -ArgumentList ($args | ForEach-Object { Quote-Argument $_ })
    exit 0
}

function Register-StagingContinuation {
    $userId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-Distro', $Distro, '-Resume')
    $argument = ($args | ForEach-Object { Quote-Argument $_ }) -join ' '
    $action = New-ScheduledTaskAction -Execute 'PowerShell.exe' -Argument $argument
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
    $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Highest
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
}

function Remove-StagingContinuation {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
}

function Test-HostReady {
    try {
        & wsl.exe -d $Distro -u root -- bash -lc 'test -x /opt/izakhono/bin/stage-project.sh && docker inspect izakhono-caddy >/dev/null 2>&1 && docker inspect izakhono-postgres >/dev/null 2>&1 && docker inspect izakhono-registry >/dev/null 2>&1'
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Wait-ForHostReady {
    Write-Host 'Waiting for the owner-host foundation to become healthy...'
    for ($i = 0; $i -lt 40; $i++) {
        if (Test-HostReady) { return }
        Start-Sleep -Seconds 30
    }
    throw '[FAIL] IZAKHONO owner-host foundation did not become ready within 20 minutes.'
}

function Stage-FirstRevenueApp {
    Write-Host "`n=== Stage THE CHANCELLOR on our own infrastructure ===" -ForegroundColor Cyan
    $linux = @'
set -euo pipefail
apt-get update >/dev/null
apt-get install -y git >/dev/null
install -d -m 0750 /srv/izakhono/repos
if [ -d /srv/izakhono/repos/the-chancellor/.git ]; then
  git -C /srv/izakhono/repos/the-chancellor fetch --prune origin main
  git -C /srv/izakhono/repos/the-chancellor checkout -f main
  git -C /srv/izakhono/repos/the-chancellor reset --hard origin/main
else
  rm -rf /srv/izakhono/repos/the-chancellor
  git clone --depth 1 --branch main https://github.com/bevanshelton-netizen/the-chancellor.git /srv/izakhono/repos/the-chancellor
fi
/opt/izakhono/bin/stage-project.sh /srv/izakhono/repos/the-chancellor
/opt/izakhono/bin/snapshot-sources.sh /srv/izakhono/repos
'@
    & wsl.exe -d $Distro -u root -- bash -lc $linux
    if ($LASTEXITCODE -ne 0) {
        throw '[FAIL] THE CHANCELLOR did not complete the IZAKHONO local staging gate.'
    }
}

Ensure-Admin

if (-not $Resume) {
    Register-StagingContinuation
    $ownerHost = Join-Path $PSScriptRoot 'windows-owner-host.ps1'
    if (-not (Test-Path $ownerHost)) { throw '[FAIL] Reviewed IZAKHONO Windows owner-host installer is missing.' }
    Write-Host 'Activating our owner-controlled IZAKHONO infrastructure first...'
    & PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File $ownerHost -Distro $Distro -AttemptRouterMapping
    if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 10) {
        throw "[FAIL] IZAKHONO owner-host activation stopped with exit code $LASTEXITCODE."
    }
}

Wait-ForHostReady
Stage-FirstRevenueApp
Remove-StagingContinuation

Write-Host "`n[PASS] THE CHANCELLOR IS NOW STAGED ON OUR OWN IZAKHONO INFRASTRUCTURE." -ForegroundColor Green
Write-Host 'The internal container health gate passed and a portable source snapshot was created.'
Write-Host 'This does not cut over the live commercial domain. Public HTTPS and paid-traffic readiness remain fail-closed until the real domain is intentionally pointed at this host.'
