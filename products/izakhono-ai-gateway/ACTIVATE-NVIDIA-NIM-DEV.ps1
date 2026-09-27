$ErrorActionPreference = "Stop"

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigScript = Join-Path $Here "CONFIGURE-NVIDIA-NIM-DEV.ps1"
$SecretScript = Join-Path $Here "SET-EXTERNAL-AI-SECRET.ps1"
$StartScript = Join-Path $Here "START-IZAKHONO-SUPER-AI-NODE01.ps1"
$VerifyScript = Join-Path $Here "VERIFY-EXTERNAL-AI.ps1"

$SecretFile = Join-Path $env:LOCALAPPDATA "Izakhono\Secrets\external-ai.key.dpapi"
$ExternalConfig = Join-Path $env:LOCALAPPDATA "Izakhono\SuperAI\external-ai.env.ps1"

function Require-File([string]$Path, [string]$Label) {
  if (-not (Test-Path $Path)) {
    throw "$Label not found: $Path"
  }
}

foreach ($pair in @(
  @($ConfigScript, "NVIDIA configuration script"),
  @($SecretScript, "external AI secret setup script"),
  @($StartScript, "SUPER AI startup script"),
  @($VerifyScript, "external AI verifier")
)) {
  Require-File -Path $pair[0] -Label $pair[1]
}

Write-Host "IZAKHONO SUPER AI - NVIDIA development activation" -ForegroundColor Cyan
Write-Host "Owned/local AI remains the default architecture."
Write-Host "This activates an explicit public-data-only external development route."
Write-Host ""

& $ConfigScript

if (-not (Test-Path $SecretFile)) {
  Write-Host ""
  Write-Host "No local DPAPI-protected external AI credential is present." -ForegroundColor Yellow
  & $SecretScript
}

Require-File $ExternalConfig "external route environment file"

. $ExternalConfig

if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_GATEWAY_INTERNAL_KEY)) {
  throw "IZAKHONO_AI_GATEWAY_INTERNAL_KEY is not present in this shell. Start this flow from the approved IZAKHONO owner environment."
}
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_WORKFLOW_KEY)) {
  throw "IZAKHONO_AI_WORKFLOW_KEY is not present in this shell. Start this flow from the approved IZAKHONO owner environment."
}

& $StartScript
& $VerifyScript

Write-Host ""
Write-Host "NVIDIA development route activation and verification completed." -ForegroundColor Green
Write-Host "The route remains public-data-only and replaceable."
