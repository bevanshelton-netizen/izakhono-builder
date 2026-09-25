#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$PublicHostname = "",
  [string]$ExternalFallback = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Report = Join-Path ([Environment]::GetFolderPath("Desktop")) "IZAKHONO-DIGITAL-FINANCE-NODE01-REPORT.json"

Write-Host "============================================================"
Write-Host "IZAKHONO DIGITAL FINANCE - NODE01 OWNED DEPLOYMENT"
Write-Host "============================================================"

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
  throw "WSL is not available."
}

$Distro = "Ubuntu"
$LinuxRoot = (& wsl.exe -d $Distro -- wslpath -a $Root).Trim()
$LinuxReport = (& wsl.exe -d $Distro -- wslpath -a $Report).Trim()

Write-Host "[1/3] Checking NODE01 readiness..."
& wsl.exe -d $Distro -u root -- curl -fsS http://127.0.0.1:9191/readyz
if ($LASTEXITCODE -ne 0) { throw "NODE01 is not ready." }

Write-Host "[2/3] Deploying immutable Digital Finance build through IZAKHONO CONTROL..."
& wsl.exe -d $Distro -u root -- python3 "$LinuxRoot/products/izakhono-node/deploy-digital-finance.py" --report "$LinuxReport"
if ($LASTEXITCODE -ne 0) {
  Write-Host "[SAFE STOP] NODE01 deployment did not pass. External route remains untouched."
  exit $LASTEXITCODE
}

Write-Host "[3/3] Local owned proof passed."
Get-Content $Report

if ($PublicHostname) {
  Write-Host ""
  Write-Host "Public hostname supplied: $PublicHostname"
  Write-Host "Run the public acceptance verifier only after EDGE/TLS routes this hostname to 127.0.0.1:8080."
  if ($ExternalFallback) {
    Write-Host "External fallback: $ExternalFallback"
  }
}

Write-Host "============================================================"
Write-Host "[PASS] NODE01 local deployment verified."
Write-Host "No OWNED LIVE VERIFIED claim is made until DNS/TLS/HTTPS acceptance passes."
Write-Host "============================================================"
