$ErrorActionPreference = "Stop"

$envFile = Join-Path $env:LOCALAPPDATA "Izakhono\SuperAI\external-ai.env.ps1"
$dir = Split-Path -Parent $envFile
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$content = @'
$env:IZAKHONO_AI_OWNER_ONLY = "false"
$env:IZAKHONO_AI_ALLOW_EXTERNAL = "true"
$env:IZAKHONO_AI_EXTERNAL_TEXT_PROVIDER = "nvidia-nim"
$env:IZAKHONO_AI_EXTERNAL_TEXT_URL = "https://integrate.api.nvidia.com/v1"
$env:IZAKHONO_AI_EXTERNAL_TEXT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b"
$env:IZAKHONO_AI_EXTERNAL_TEXT_MODELS = "nvidia/nemotron-3-ultra-550b-a55b"
$env:IZAKHONO_AI_EXTERNAL_HOSTS = "integrate.api.nvidia.com"
'@

Set-Content -Path $envFile -Value $content -Encoding UTF8

Write-Host "NVIDIA NIM development route configuration prepared." -ForegroundColor Green
Write-Host "Configuration: $envFile"
Write-Host "No API key was stored in this file."
Write-Host ""
Write-Host "Next:"
Write-Host "  1. Run SET-EXTERNAL-AI-SECRET.cmd once."
Write-Host "  2. Dot-source the configuration before starting SUPER AI:"
Write-Host "     . '$envFile'"
Write-Host "  3. Start SUPER AI and run VERIFY-EXTERNAL-AI.cmd."
