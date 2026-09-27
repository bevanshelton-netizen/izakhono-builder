$ErrorActionPreference = "Stop"

$Receipt = Join-Path $env:USERPROFILE "Desktop\IZAKHONO-SUPER-AI-EXTERNAL-RECEIPT.txt"
$GatewayUrl = if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_GATEWAY_URL)) {
  "http://127.0.0.1:9595"
} else {
  $env:IZAKHONO_AI_GATEWAY_URL.TrimEnd("/")
}

function Write-Receipt([string[]]$Lines) {
  $Lines + "TIME=$([DateTime]::UtcNow.ToString('o'))" | Set-Content -Encoding UTF8 $Receipt
}

function Fail([string]$Message) {
  Write-Receipt @(
    "IZAKHONO SUPER AI EXTERNAL ROUTE"
    "STATUS=FAILED"
    "DETAIL=$Message"
    "GATEWAY=$GatewayUrl"
  )
  throw $Message
}

foreach ($required in @(
  "IZAKHONO_AI_GATEWAY_INTERNAL_KEY",
  "IZAKHONO_AI_WORKFLOW_KEY"
)) {
  $value = [Environment]::GetEnvironmentVariable($required)
  if ([string]::IsNullOrWhiteSpace($value)) {
    Fail "$required is required for verification"
  }
}

$headers = @{
  "x-izakhono-ai-key" = $env:IZAKHONO_AI_GATEWAY_INTERNAL_KEY
  "x-izakhono-ai-workflow-key" = $env:IZAKHONO_AI_WORKFLOW_KEY
}

try {
  $health = Invoke-RestMethod -Uri "$GatewayUrl/healthz" -TimeoutSec 10
} catch {
  Fail "Gateway health check failed: $($_.Exception.Message)"
}

if (-not $health.ok) { Fail "Gateway health did not report ok" }
if (-not $health.external_ai_providers_enabled) {
  Fail "External AI provider is not enabled in the running gateway"
}

$payload = @{
  entity_id = "izakhono-africa"
  product = "izakhono-builder"
  subject = "izakhono-external-verifier"
  access_mode = "workflow"
  capability = "code"
  route = "external"
  data_classification = "public"
  prompt = "Return exactly: IZAKHONO_EXTERNAL_ROUTE_OK"
} | ConvertTo-Json -Depth 6

try {
  $response = Invoke-RestMethod -Method Post -Uri "$GatewayUrl/api/v1/generate" -Headers $headers -ContentType "application/json" -Body $payload -TimeoutSec 180
} catch {
  Fail "External route request failed: $($_.Exception.Message)"
}

if (-not $response.ok) { Fail "Gateway response did not report ok" }
if ($response.route -ne "external") { Fail "Gateway response was not marked external" }
if ($response.data_classification -ne "public") { Fail "Gateway response did not retain public classification" }

$text = [string]$response.output.text
if ($text -notmatch "IZAKHONO_EXTERNAL_ROUTE_OK") {
  Fail "External provider answered, but verification marker was not returned"
}

Write-Receipt @(
  "IZAKHONO SUPER AI EXTERNAL ROUTE"
  "STATUS=VERIFIED"
  "GATEWAY=$GatewayUrl"
  "PROVIDER=$($response.external_provider)"
  "MODEL=$($response.model)"
  "ROUTE=$($response.route)"
  "DATA_CLASSIFICATION=$($response.data_classification)"
  "SECRET_PERSISTED_BY_SCRIPT=false"
  "PUBLIC_LIVE_CLAIM=false"
)

Write-Host "IZAKHONO SUPER AI external development route verified." -ForegroundColor Green
Write-Host "Receipt: $Receipt"
