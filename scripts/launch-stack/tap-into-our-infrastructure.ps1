#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Distro = 'Ubuntu',
    [switch]$Resume
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$TaskName = 'IZAKHONO Stage Reviewed Platform Fleet'

$ReviewedPlatforms = @(
    @{
        Name = 'THE CHANCELLOR'
        Slug = 'the-chancellor'
        Repository = 'https://github.com/bevanshelton-netizen/the-chancellor.git'
        Commit = '803fd8fdb5d5de3c59a9f2c8047e177bee2a9e68'
    },
    @{
        Name = 'ALLEGRO-VIBEZ'
        Slug = 'allegro-vibez'
        Repository = 'https://github.com/bevanshelton-netizen/allegro-vibez.git'
        Commit = '53cf53a20f730c953701877c7e7195ed3a3015e5'
    }
)

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
        & wsl.exe -d $Distro -u root -- bash -lc 'test -x /opt/izakhono/bin/stage-project.sh && test -x /opt/izakhono/bin/stage-reviewed-public-project.sh && docker inspect izakhono-caddy >/dev/null 2>&1 && docker inspect izakhono-postgres >/dev/null 2>&1 && docker inspect izakhono-registry >/dev/null 2>&1 && docker inspect izakhono-core >/dev/null 2>&1'
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

function Stage-ReviewedPlatform([hashtable]$Platform) {
    Write-Host "`n=== Stage $($Platform.Name) on our own infrastructure ===" -ForegroundColor Cyan
    $repo = $Platform.Repository.Replace("'", "'\"'\"'")
    $commit = $Platform.Commit.Replace("'", "'\"'\"'")
    $slug = $Platform.Slug.Replace("'", "'\"'\"'")
    $linux = "set -euo pipefail; apt-get update >/dev/null; apt-get install -y git >/dev/null; /opt/izakhono/bin/stage-reviewed-public-project.sh '$repo' '$commit' '$slug'"
    & wsl.exe -d $Distro -u root -- bash -lc $linux
    if ($LASTEXITCODE -ne 0) {
        throw "[FAIL] $($Platform.Name) did not complete the IZAKHONO local staging gate."
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
foreach ($platform in $ReviewedPlatforms) {
    Stage-ReviewedPlatform $platform
}
Remove-StagingContinuation

Write-Host "`n[PASS] REVIEWED IZAKHONO PLATFORM FLEET IS STAGED ON OUR OWN INFRASTRUCTURE." -ForegroundColor Green
Write-Host 'THE CHANCELLOR and ALLEGRO-VIBEZ were fetched at immutable reviewed commits, built locally, placed in our registry and passed internal health gates.'
Write-Host 'Portable source snapshots and checksummed staging evidence were created on the owner host.'
Write-Host 'This does not cut over a commercial domain or enable live payments. Public HTTPS and each application readiness gate remain fail-closed until an intentional launch.'
