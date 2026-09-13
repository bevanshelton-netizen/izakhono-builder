#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Distro = 'Ubuntu'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Fleet = @(
    @{ Repo = 'Downloads'; Instance = 'downloads' },
    @{ Repo = 'allegro-vibez'; Instance = 'allegro-vibez' },
    @{ Repo = 'the-chancellor'; Instance = 'the-chancellor' },
    @{ Repo = 'edubuild-ecd360'; Instance = 'edubuild-ecd360' }
)

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Quote-Argument([string]$Value) {
    return '"' + ($Value -replace '"', '\\"') + '"'
}

function Ensure-Admin {
    if (Test-IsAdministrator) { return }
    $args = @('-NoProfile','-ExecutionPolicy','Bypass','-File',$PSCommandPath,'-Distro',$Distro)
    Start-Process -FilePath 'PowerShell.exe' -Verb RunAs -ArgumentList (($args | ForEach-Object { Quote-Argument $_ }) -join ' ')
    exit 0
}

function Get-InstalledDistros {
    return @(wsl.exe -l -q 2>$null | ForEach-Object { ($_ -replace ([char]0), '').Trim() } | Where-Object { $_ })
}

function Resolve-Distro {
    $installed = Get-InstalledDistros
    if ($installed -contains $Distro) { return $Distro }
    foreach ($candidate in @('Ubuntu-24.04','Ubuntu')) {
        if ($installed -contains $candidate) { return $candidate }
    }
    throw '[FAIL] No supported Ubuntu WSL owner host was found. Run START-IZAKHONO-OWNER-HOST.cmd first.'
}

function Refresh-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path','Machine')
    $user = [Environment]::GetEnvironmentVariable('Path','User')
    $env:Path = $machine + ';' + $user
}

function Ensure-GitHubCli {
    if (Get-Command gh.exe -ErrorAction SilentlyContinue) { return }
    if (Get-Command winget.exe -ErrorAction SilentlyContinue) {
        Write-Host 'Installing GitHub CLI...' -ForegroundColor Cyan
        & winget.exe install --id GitHub.cli --exact --silent --accept-package-agreements --accept-source-agreements
        Refresh-Path
    }
    if (-not (Get-Command gh.exe -ErrorAction SilentlyContinue)) {
        throw '[FAIL] GitHub CLI is required. Install GitHub CLI, then run this launcher again.'
    }
}

function Ensure-GitHubLogin {
    & gh.exe auth status --hostname github.com *> $null
    if ($LASTEXITCODE -eq 0) { return }
    Write-Host ''
    Write-Host 'GitHub authorization is required once on this owner laptop.' -ForegroundColor Cyan
    Write-Host 'GitHub will use its secure browser/device sign-in. IZAKHONO does not receive your password.'
    & gh.exe auth login --hostname github.com --git-protocol https --web --scopes 'repo,workflow'
    if ($LASTEXITCODE -ne 0) {
        throw '[FAIL] GitHub authorization did not complete.'
    }
}

function Get-RepoRootInWsl([string]$ResolvedDistro) {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $line = & wsl.exe -d $ResolvedDistro -u root -- wslpath -a -u $repoRoot 2>$null | Select-Object -First 1
    if (-not $line) { throw '[FAIL] Could not translate the IZAKHONO Builder path into WSL.' }
    return $line.Trim()
}

function Test-OwnerHost([string]$ResolvedDistro) {
    & wsl.exe -d $ResolvedDistro -u root -- bash -lc 'docker info >/dev/null 2>&1 && test -d /opt/izakhono'
    if ($LASTEXITCODE -ne 0) {
        throw '[FAIL] IZAKHONO owner-host foundation is not healthy. Run START-IZAKHONO-OWNER-HOST.cmd first.'
    }
}

Ensure-Admin
$ResolvedDistro = Resolve-Distro
Ensure-GitHubCli
Ensure-GitHubLogin
Test-OwnerHost $ResolvedDistro

$wslRoot = Get-RepoRootInWsl $ResolvedDistro
$installer = "$wslRoot/scripts/launch-stack/install-actions-runner.sh"

Write-Host ''
Write-Host '=================================================' -ForegroundColor Cyan
Write-Host '     IZAKHONO NODE01 MULTI-RUNNER FLEET' -ForegroundColor Cyan
Write-Host '=================================================' -ForegroundColor Cyan
Write-Host 'Registering Downloads, Allegro, The Chancellor and EDU-BUILD/ECD360.'
Write-Host 'Each registration token is short-lived, generated locally and passed through stdin only.'
Write-Host ''

foreach ($item in $Fleet) {
    $repoName = [string]$item.Repo
    $instance = [string]$item.Instance
    $repoPath = "bevanshelton-netizen/$repoName"
    $repoUrl = "https://github.com/$repoPath"

    Write-Host "Registering $repoName..." -ForegroundColor Cyan
    $token = (& gh.exe api --method POST "repos/$repoPath/actions/runners/registration-token" --jq '.token').Trim()
    if ($LASTEXITCODE -ne 0 -or $token -notmatch '^[A-Za-z0-9_-]{20,200}$') {
        throw "[FAIL] Could not create the short-lived runner token for $repoPath. GitHub authorization must have repository admin access."
    }

    try {
        $linux = "read -r IZAKHONO_GITHUB_RUNNER_TOKEN; export IZAKHONO_GITHUB_RUNNER_TOKEN; export IZAKHONO_ACTIONS_RUNNER_INSTANCE='$instance'; exec bash '$installer' '$repoUrl'"
        $token | & wsl.exe -d $ResolvedDistro -u root -- bash -lc $linux
        if ($LASTEXITCODE -ne 0) {
            throw "[FAIL] Runner registration failed for $repoPath."
        }
    }
    finally {
        $token = $null
        [GC]::Collect()
    }
}

Write-Host ''
Write-Host '[PASS] NODE01 MULTI-RUNNER FLEET IS ONLINE.' -ForegroundColor Green
Write-Host 'Queued owner-host workflows can now be claimed automatically.'
Write-Host 'Keep NODE01 powered on while the migration queue drains.'
