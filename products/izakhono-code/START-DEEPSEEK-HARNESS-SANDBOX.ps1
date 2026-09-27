$ErrorActionPreference = "Stop"

$PinnedHarness = "@deepseek-ai/dsh@0.1.7-rc.2"
$Root = Join-Path $env:LOCALAPPDATA "Izakhono\HarnessSandbox"
$DshHome = Join-Path $Root "dsh-home"
$Workspace = Join-Path $Root "workspace"

function Fail([string]$Message) {
    Write-Host ""
    Write-Host "IZAKHONO HARNESS SANDBOX - STOPPED" -ForegroundColor Red
    Write-Host $Message -ForegroundColor Red
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js is required. Install a supported Node.js release before using the sandbox."
}
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
    Fail "npx is required and was not found."
}

$NodeVersion = (& node -p "process.versions.node").Trim()
$Parts = $NodeVersion.Split(".")
$Major = [int]$Parts[0]
$Minor = [int]$Parts[1]
if (($Major -lt 22) -or (($Major -eq 22) -and ($Minor -lt 19)) -or ($Major -eq 23)) {
    Fail "DeepSeek Harness 0.1.7-rc.2 requires Node ^22.19.0 or >=24.0.0. Found $NodeVersion."
}

New-Item -ItemType Directory -Force -Path $DshHome | Out-Null
New-Item -ItemType Directory -Force -Path $Workspace | Out-Null

$Notice = @"
IZAKHONO HARNESS SANDBOX

This folder is deliberately isolated from IZAKHONO production repositories.
Do not copy production credentials, customer data, FORTRESS intelligence,
payment keys, DNS/cloud admin credentials or unpublished proprietary source here.

Harness is developer-preview software and is not an IZAKHONO security boundary.
"@
Set-Content -Path (Join-Path $Workspace "README-IZAKHONO-SANDBOX.txt") -Value $Notice -Encoding UTF8

$env:DSH_HOME = $DshHome
$env:NODE_OPTIONS = "--max-old-space-size=4096"

Write-Host "IZAKHONO CODE - DeepSeek Harness isolated evaluation" -ForegroundColor Cyan
Write-Host "Pinned package: $PinnedHarness"
Write-Host "Workspace: $Workspace"
Write-Host "DSH_HOME: $DshHome"
Write-Host "No API key has been injected by this launcher."
Write-Host "The Web UI should bind to loopback on its default port." -ForegroundColor Yellow
Write-Host ""

Push-Location $Workspace
try {
    & npx --yes $PinnedHarness web --no-open
    if ($LASTEXITCODE -ne 0) {
        Fail "Harness exited with code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}
