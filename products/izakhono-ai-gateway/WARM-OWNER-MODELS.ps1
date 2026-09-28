param(
  [string[]]$Models = @(),
  [string[]]$RuntimeIds = @()
)

$ErrorActionPreference = "Stop"
$Receipt = Join-Path $env:USERPROFILE "Desktop\IZAKHONO-SUPER-AI-WARM-RECEIPT.txt"

function Fail([string]$Message) {
  @(
    "IZAKHONO SUPER AI WARM POOL"
    "STATUS=FAILED"
    "DETAIL=$Message"
    "TIME=$([DateTime]::UtcNow.ToString('o'))"
  ) | Set-Content -Encoding UTF8 $Receipt
  throw $Message
}

if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_GATEWAY_INTERNAL_KEY)) {
  Fail "IZAKHONO_AI_GATEWAY_INTERNAL_KEY must be present in the approved owner environment"
}

$payload = @{}
if ($Models.Count -gt 0) { $payload.models = @($Models) }
if ($RuntimeIds.Count -gt 0) { $payload.runtime_ids = @($RuntimeIds) }

$headers = @{ "x-izakhono-ai-key" = $env:IZAKHONO_AI_GATEWAY_INTERNAL_KEY }

try {
  $result = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:9595/api/v1/warm" -Headers $headers -ContentType "application/json" -Body ($payload | ConvertTo-Json -Depth 5) -TimeoutSec 900
} catch {
  Fail "Warm-pool request failed: $($_.Exception.Message)"
}

@(
  "IZAKHONO SUPER AI WARM POOL"
  "STATUS=COMPLETED"
  "ATTEMPTED=$($result.attempted)"
  "SUCCEEDED=$($result.succeeded)"
  "FAILED=$($result.failed)"
  "CONFIGURED_MODELS=$([string]::Join(',', @($result.configured_models)))"
  "PUBLIC_LIVE_CLAIM=false"
  "TIME=$([DateTime]::UtcNow.ToString('o'))"
) | Set-Content -Encoding UTF8 $Receipt

Write-Host "IZAKHONO SUPER AI warm-pool command completed." -ForegroundColor Green
Write-Host "Attempted: $($result.attempted)  Succeeded: $($result.succeeded)  Failed: $($result.failed)"
Write-Host "Receipt: $Receipt"
