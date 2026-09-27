$ErrorActionPreference = "Stop"

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Gateway = Join-Path $Here "app.py"
$Receipt = Join-Path $env:USERPROFILE "Desktop\IZAKHONO-SUPER-AI-RECEIPT.txt"

function Fail([string]$Message) {
  @(
    "IZAKHONO SUPER AI"
    "LOCAL_GATEWAY=FAILED"
    "PUBLIC_HTTPS=UNVERIFIED"
    "DETAIL=$Message"
    "TIME=$([DateTime]::UtcNow.ToString('o'))"
  ) | Set-Content -Encoding UTF8 $Receipt
  throw $Message
}

if (-not (Test-Path $Gateway)) { Fail "Gateway app.py not found" }
if (-not (Get-Command python -ErrorAction SilentlyContinue)) { Fail "Python is not installed or not on PATH" }
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) { Fail "Ollama is not installed or not on PATH" }

if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_GATEWAY_INTERNAL_KEY)) {
  Fail "IZAKHONO_AI_GATEWAY_INTERNAL_KEY must be set before startup"
}
$subscriberAccessConfigured = -not [string]::IsNullOrWhiteSpace($env:IZAKHONO_ACCESS_INTERNAL_KEY)
$workflowConfigured = -not [string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_WORKFLOW_KEY)
if (-not $subscriberAccessConfigured -and -not $workflowConfigured) {
  Fail "Set IZAKHONO_ACCESS_INTERNAL_KEY for subscriber mode or IZAKHONO_AI_WORKFLOW_KEY for trusted internal workflow mode before startup"
}

if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_OWNER_ONLY)) { $env:IZAKHONO_AI_OWNER_ONLY = "true" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_ALLOW_EXTERNAL)) { $env:IZAKHONO_AI_ALLOW_EXTERNAL = "false" }

$externalRequested = (
  $env:IZAKHONO_AI_ALLOW_EXTERNAL -eq "true" -and
  $env:IZAKHONO_AI_OWNER_ONLY -eq "false"
)
if ($externalRequested) {
  foreach ($required in @(
    "IZAKHONO_AI_EXTERNAL_TEXT_URL",
    "IZAKHONO_AI_EXTERNAL_TEXT_API_KEY",
    "IZAKHONO_AI_EXTERNAL_TEXT_MODEL"
  )) {
    $value = [Environment]::GetEnvironmentVariable($required)
    if ([string]::IsNullOrWhiteSpace($value)) {
      Fail "$required must be set when external AI development routing is requested"
    }
  }
}
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_CHAT_MODEL)) { $env:IZAKHONO_AI_CHAT_MODEL = "qwen3:4b" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_REASONING_MODEL)) { $env:IZAKHONO_AI_REASONING_MODEL = $env:IZAKHONO_AI_CHAT_MODEL }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_CODE_MODEL)) { $env:IZAKHONO_AI_CODE_MODEL = $env:IZAKHONO_AI_CHAT_MODEL }

$requiredModels = @(
  $env:IZAKHONO_AI_CHAT_MODEL,
  $env:IZAKHONO_AI_REASONING_MODEL,
  $env:IZAKHONO_AI_CODE_MODEL
) | Select-Object -Unique

$installed = @(ollama list 2>$null | Select-Object -Skip 1 | ForEach-Object { ($_ -split "\s+")[0] })
foreach ($model in $requiredModels) {
  if ($installed -notcontains $model) {
    Write-Host "Pulling owner model $model ..."
    ollama pull $model
    if ($LASTEXITCODE -ne 0) { Fail "Model pull failed: $model" }
  }
}

$existing = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine.Contains("app.py") -and $_.CommandLine.Contains("izakhono-ai-gateway") }

$needsRestart = $false
if ($existing) {
  try {
    $probeHeaders = @{ "x-izakhono-ai-key" = $env:IZAKHONO_AI_GATEWAY_INTERNAL_KEY }
    $probe = Invoke-RestMethod -Uri "http://127.0.0.1:9595/api/v1/capabilities" -Headers $probeHeaders -TimeoutSec 3
    if (-not $probe.ok) { $needsRestart = $true }
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:9595/healthz" -TimeoutSec 3
    if ($workflowConfigured -and -not $h.workflow_mode_configured) { $needsRestart = $true }
    if ($externalRequested -and -not $h.external_ai_providers_enabled) { $needsRestart = $true }
    if (-not $externalRequested -and $h.external_ai_providers_enabled) { $needsRestart = $true }
  } catch {
    $needsRestart = $true
  }
}

if ($needsRestart -and $existing) {
  foreach ($p in @($existing)) {
    try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {}
  }
  Start-Sleep -Milliseconds 500
  $existing = $null
}

if (-not $existing) {
  Start-Process -FilePath "python" -ArgumentList @($Gateway) -WorkingDirectory $Here -WindowStyle Hidden
}

$health = $null
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:9595/healthz" -TimeoutSec 3
    if ($health.ok) { break }
  } catch {}
}
if (-not $health -or -not $health.ok) { Fail "Local health gate did not pass" }

@(
  "IZAKHONO SUPER AI"
  "LOCAL_GATEWAY=VERIFIED"
  "PUBLIC_HTTPS=UNVERIFIED"
  "OWNER_ONLY=$($health.owner_only)"
  "WORKFLOW_MODE_CONFIGURED=$($health.workflow_mode_configured)"
  "SUBSCRIBER_ACCESS_CONFIGURED=$subscriberAccessConfigured"
  "CAPABILITIES_READY=$([string]::Join(',', @($health.capabilities_ready)))"
  "EXTERNAL_AI_ENABLED=$($health.external_ai_providers_enabled)"
  "EXTERNAL_AI_PROVIDER=$($health.external_ai_provider)"
  "MEDIA_BACKENDS=VERIFY_WITH_/api/v1/capabilities"
  "NOTE=Local gateway proof is not public-live proof."
  "TIME=$([DateTime]::UtcNow.ToString('o'))"
) | Set-Content -Encoding UTF8 $Receipt

Write-Host "IZAKHONO SUPER AI local gateway verified."
Write-Host "Receipt: $Receipt"
