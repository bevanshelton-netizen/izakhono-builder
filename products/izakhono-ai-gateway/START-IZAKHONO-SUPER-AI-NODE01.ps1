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

$workflowProducts = @()
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_WORKFLOW_PRODUCTS)) {
  $workflowProducts = @(
    "venture-factory","izakhono-builder","izakhono-docflow","izakhono-flow",
    "izakhono-shorts","izakhono-create","kora","allegro","edu-build",
    "izakhono-ads","izakhono-recording-studio","worknow","faisready","doxa-sure","auto-ai"
  )
} else {
  $workflowProducts = @(
    $env:IZAKHONO_AI_WORKFLOW_PRODUCTS.Split(",") |
      ForEach-Object { $_.Trim().ToLowerInvariant() } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )
  if ($workflowProducts -notcontains "izakhono-docflow") {
    $workflowProducts += "izakhono-docflow"
  }
  if ($workflowProducts -notcontains "izakhono-flow") {
    $workflowProducts += "izakhono-flow"
  }
}
$env:IZAKHONO_AI_WORKFLOW_PRODUCTS = [string]::Join(",", $workflowProducts)

if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_OWNER_ONLY)) { $env:IZAKHONO_AI_OWNER_ONLY = "true" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_ALLOW_EXTERNAL)) { $env:IZAKHONO_AI_ALLOW_EXTERNAL = "false" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_MAX_INFLIGHT)) { $env:IZAKHONO_AI_MAX_INFLIGHT = "4" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_MAX_QUEUE)) { $env:IZAKHONO_AI_MAX_QUEUE = "16" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_QUEUE_TIMEOUT_SECONDS)) { $env:IZAKHONO_AI_QUEUE_TIMEOUT_SECONDS = "20" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_ROUTING_EWMA_ALPHA)) { $env:IZAKHONO_AI_ROUTING_EWMA_ALPHA = "0.35" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_ROUTING_UNKNOWN_LATENCY_MS)) { $env:IZAKHONO_AI_ROUTING_UNKNOWN_LATENCY_MS = "3000" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_ROUTING_INFLIGHT_PENALTY_MS)) { $env:IZAKHONO_AI_ROUTING_INFLIGHT_PENALTY_MS = "1500" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_ROUTING_WARM_BONUS_MS)) { $env:IZAKHONO_AI_ROUTING_WARM_BONUS_MS = "600" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_WARM_MAX_MODELS)) { $env:IZAKHONO_AI_WARM_MAX_MODELS = "3" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_WARM_KEEP_ALIVE)) { $env:IZAKHONO_AI_WARM_KEEP_ALIVE = "15m" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_WARM_TTL_SECONDS)) { $env:IZAKHONO_AI_WARM_TTL_SECONDS = "900" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_WARM_TIMEOUT_SECONDS)) { $env:IZAKHONO_AI_WARM_TIMEOUT_SECONDS = "180" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_WARM_ON_START)) { $env:IZAKHONO_AI_WARM_ON_START = "false" }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_MAX_BODY)) { $env:IZAKHONO_AI_MAX_BODY = "16000000" }

function Get-WslSecret([string]$Path, [string]$Key) {
  if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { return $null }
  try {
    $value = & wsl.exe -d Ubuntu -u root -- bash -lc "sed -n 's/^$Key=//p' '$Path' | tail -1" 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($value)) {
      return ($value | Select-Object -First 1).Trim()
    }
  } catch {}
  return $null
}

function Attach-LocalMediaRuntime([string]$Name, [int]$Port, [string]$EnvPath, [string]$SecretKey, [string]$UrlVariable, [string]$KeyVariable) {
  $explicitUrl = [Environment]::GetEnvironmentVariable($UrlVariable)
  $explicitKey = [Environment]::GetEnvironmentVariable($KeyVariable)
  if (-not [string]::IsNullOrWhiteSpace($explicitUrl) -and -not [string]::IsNullOrWhiteSpace($explicitKey)) {
    return $true
  }
  try {
    $runtimeHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/healthz" -TimeoutSec 3
    if (-not $runtimeHealth.ok) { return $false }
    $key = Get-WslSecret $EnvPath $SecretKey
    if ([string]::IsNullOrWhiteSpace($key)) { return $false }
    [Environment]::SetEnvironmentVariable($UrlVariable, "http://127.0.0.1:$Port", "Process")
    [Environment]::SetEnvironmentVariable($KeyVariable, $key, "Process")
    Write-Host "$Name attached to SUPER AI through owner localhost."
    return $true
  } catch {
    return $false
  }
}

$speechAttached = Attach-LocalMediaRuntime "IZAKHONO Speech Runtime" 9731 "/etc/izakhono/apps/izakhono-speech-runtime.env" "IZAKHONO_SPEECH_INTERNAL_KEY" "IZAKHONO_SPEECH_URL" "IZAKHONO_SPEECH_INTERNAL_KEY"
$videoAttached = Attach-LocalMediaRuntime "IZAKHONO Video Runtime" 9741 "/etc/izakhono/apps/izakhono-video-runtime.env" "IZAKHONO_VIDEO_INTERNAL_KEY" "IZAKHONO_VIDEO_URL" "IZAKHONO_VIDEO_INTERNAL_KEY"
$fabricAttached = Attach-LocalMediaRuntime "IZAKHONO Media Runtime Fabric" 9751 "/etc/izakhono/apps/izakhono-media-fabric.env" "IZAKHONO_MEDIA_FABRIC_INTERNAL_KEY" "IZAKHONO_MEDIA_FABRIC_URL" "IZAKHONO_MEDIA_FABRIC_INTERNAL_KEY"

$externalRequested = (
  $env:IZAKHONO_AI_ALLOW_EXTERNAL -eq "true" -and
  $env:IZAKHONO_AI_OWNER_ONLY -eq "false"
)
if ($externalRequested) {
  if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_EXTERNAL_TEXT_API_KEY)) {
    $secretFile = Join-Path $env:LOCALAPPDATA "Izakhono\Secrets\external-ai.key.dpapi"
    if (Test-Path $secretFile) {
      try {
        $encrypted = Get-Content -Raw $secretFile
        $secure = ConvertTo-SecureString $encrypted
        $credential = New-Object System.Management.Automation.PSCredential("external-ai", $secure)
        $env:IZAKHONO_AI_EXTERNAL_TEXT_API_KEY = $credential.GetNetworkCredential().Password
      } catch {
        Fail "The local DPAPI external-AI secret could not be decrypted for this Windows user"
      }
    }
  }

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
$ownerPoolRequested = @()
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_OWNER_TEXT_URLS)) {
  $primaryOwnerUrl = if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_OLLAMA_URL)) { "http://127.0.0.1:11434" } else { $env:IZAKHONO_OLLAMA_URL.TrimEnd("/") }
  $ownerPoolRequested = @($primaryOwnerUrl)
} else {
  $ownerPoolRequested = @(
    $env:IZAKHONO_AI_OWNER_TEXT_URLS.Split(",") |
      ForEach-Object { $_.Trim().TrimEnd("/") } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )
  if ($ownerPoolRequested.Count -gt 16) {
    Fail "IZAKHONO_AI_OWNER_TEXT_URLS exceeds the 16-runtime safety limit"
  }
}
if ($ownerPoolRequested.Count -lt 1) {
  Fail "At least one owner text runtime must be configured"
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
    $speechCapability = @($probe.capabilities | Where-Object { $_.capability -eq "speech" } | Select-Object -First 1)
    $videoCapability = @($probe.capabilities | Where-Object { $_.capability -eq "video" } | Select-Object -First 1)
    if ($speechCapability.Count -eq 0 -or [bool]$speechCapability[0].configured -ne [bool]$speechAttached) { $needsRestart = $true }
    if ($videoCapability.Count -eq 0 -or [bool]$videoCapability[0].configured -ne [bool]$videoAttached) { $needsRestart = $true }
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:9595/healthz" -TimeoutSec 3
    if ([bool]$h.media_fabric.configured -ne [bool]$fabricAttached) { $needsRestart = $true }
    if ($workflowConfigured -and -not $h.workflow_mode_configured) { $needsRestart = $true }
    if ([int]$h.owner_text_pool_size -ne $ownerPoolRequested.Count) { $needsRestart = $true }
    if ([int]$h.admission.max_inflight -ne [int]$env:IZAKHONO_AI_MAX_INFLIGHT) { $needsRestart = $true }
    if ([int]$h.admission.max_queue -ne [int]$env:IZAKHONO_AI_MAX_QUEUE) { $needsRestart = $true }
    if ([double]$h.routing.unknown_latency_ms -ne [double]$env:IZAKHONO_AI_ROUTING_UNKNOWN_LATENCY_MS) { $needsRestart = $true }
    if ([double]$h.routing.inflight_penalty_ms -ne [double]$env:IZAKHONO_AI_ROUTING_INFLIGHT_PENALTY_MS) { $needsRestart = $true }
    if ([double]$h.routing.warm_bonus_ms -ne [double]$env:IZAKHONO_AI_ROUTING_WARM_BONUS_MS) { $needsRestart = $true }
    if ([int]$h.warm_pool.ttl_seconds -ne [int]$env:IZAKHONO_AI_WARM_TTL_SECONDS) { $needsRestart = $true }
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

$warmAttempted = 0
$warmSucceeded = 0
$warmFailed = 0
if ($env:IZAKHONO_AI_WARM_ON_START -eq "true") {
  try {
    $warmHeaders = @{ "x-izakhono-ai-key" = $env:IZAKHONO_AI_GATEWAY_INTERNAL_KEY }
    $warmBody = @{} | ConvertTo-Json
    $warm = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:9595/api/v1/warm" -Headers $warmHeaders -ContentType "application/json" -Body $warmBody -TimeoutSec ([int]$env:IZAKHONO_AI_WARM_TIMEOUT_SECONDS * 4)
    $warmAttempted = [int]$warm.attempted
    $warmSucceeded = [int]$warm.succeeded
    $warmFailed = [int]$warm.failed
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:9595/healthz" -TimeoutSec 3
  } catch {
    Write-Warning "SUPER AI warm-on-start did not complete: $($_.Exception.Message)"
  }
}

@(
  "IZAKHONO SUPER AI"
  "LOCAL_GATEWAY=VERIFIED"
  "PUBLIC_HTTPS=UNVERIFIED"
  "OWNER_ONLY=$($health.owner_only)"
  "WORKFLOW_MODE_CONFIGURED=$($health.workflow_mode_configured)"
  "SUBSCRIBER_ACCESS_CONFIGURED=$subscriberAccessConfigured"
  "CAPABILITIES_READY=$([string]::Join(',', @($health.capabilities_ready)))"
  "OWNER_TEXT_POOL_SIZE=$($health.owner_text_pool_size)"
  "OWNER_TEXT_POOL_AVAILABLE=$($health.owner_text_pool_available)"
  "ADMISSION_MAX_INFLIGHT=$($health.admission.max_inflight)"
  "ADMISSION_MAX_QUEUE=$($health.admission.max_queue)"
  "ADMISSION_INFLIGHT=$($health.admission.inflight)"
  "ADMISSION_QUEUED=$($health.admission.queued)"
  "ROUTING_STRATEGY=$($health.routing.strategy)"
  "WARM_CONFIGURED_MODELS=$($health.warm_pool.configured_model_count)"
  "WARM_ACTIVE_RUNTIME_MODEL_PAIRS=$($health.warm_pool.active_runtime_model_pairs)"
  "WARM_ON_START=$($env:IZAKHONO_AI_WARM_ON_START)"
  "WARM_ATTEMPTED=$warmAttempted"
  "WARM_SUCCEEDED=$warmSucceeded"
  "WARM_FAILED=$warmFailed"
  "EXTERNAL_AI_ENABLED=$($health.external_ai_providers_enabled)"
  "EXTERNAL_AI_PROVIDER=$($health.external_ai_provider)"
  "SPEECH_RUNTIME_ATTACHED=$speechAttached"
  "VIDEO_RUNTIME_ATTACHED=$videoAttached"
  "MEDIA_FABRIC_ATTACHED=$fabricAttached"
  "MEDIA_FABRIC_BROKER_OK=$($health.media_fabric.ok)"
  "MEDIA_FABRIC_PRODUCTION_READY=$($health.media_fabric.production_ready)"
  "MEDIA_BACKENDS=VERIFY_WITH_/api/v1/capabilities"
  "NOTE=Local gateway proof is not public-live proof."
  "TIME=$([DateTime]::UtcNow.ToString('o'))"
) | Set-Content -Encoding UTF8 $Receipt

Write-Host "IZAKHONO SUPER AI local gateway verified."
Write-Host "Receipt: $Receipt"
