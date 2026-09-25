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
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_ACCESS_INTERNAL_KEY)) {
  Fail "IZAKHONO_ACCESS_INTERNAL_KEY must be set before startup"
}

if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_OWNER_ONLY)) { $env:IZAKHONO_AI_OWNER_ONLY = "true" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_ALLOW_EXTERNAL)) { $env:IZAKHONO_AI_ALLOW_EXTERNAL = "false" }
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
  Where-Object { $_.CommandLine -and $_.CommandLine.Contains("izakhono-ai-gateway") -and $_.CommandLine.Contains("app.py") }

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
  "CAPABILITIES_READY=$([string]::Join(',', @($health.capabilities_ready)))"
  "MEDIA_BACKENDS=VERIFY_WITH_/api/v1/capabilities"
  "NOTE=Local gateway proof is not public-live proof."
  "TIME=$([DateTime]::UtcNow.ToString('o'))"
) | Set-Content -Encoding UTF8 $Receipt

Write-Host "IZAKHONO SUPER AI local gateway verified."
Write-Host "Receipt: $Receipt"
