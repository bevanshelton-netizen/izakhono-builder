#requires -Version 5.1
[CmdletBinding()]
param([string]$Distro = 'Ubuntu-24.04')

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Write-ReceiptAndStop([string]$Message) {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $receipt = Join-Path $desktop 'IZAKHONO-VENTURE-FACTORY-DEPLOYMENT.txt'
  @(
    'IZAKHONO VENTURE FACTORY DEPLOYMENT'
    ('Generated: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss K'))
    'DEPLOYMENT_ACCEPTED=false'
    'LOCAL_HEALTH=UNVERIFIED'
    'OWNER_ACCESS=UNVERIFIED'
    'PUBLIC_HTTPS=UNVERIFIED'
    ('DETAIL=' + $Message)
  ) | Set-Content -Path $receipt -Encoding UTF8
  throw $Message
}

function New-HexSecret([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($buffer)).Replace('-', '').ToLowerInvariant()
}

function Read-EnvValue([string]$Content, [string]$Key) {
  foreach ($line in ($Content -split "[
]+")) {
    if ($line.StartsWith($Key + '=')) {
      return $line.Substring($Key.Length + 1).Trim()
    }
  }
  return ''
}

$repo = (Resolve-Path $PSScriptRoot).Path
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-ReceiptAndStop 'git is not installed or not on PATH.' }
if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) { Write-ReceiptAndStop 'WSL is not available.' }

$branch = (git -C $repo rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne 'main') { Write-ReceiptAndStop ('Switch to verified main before deployment. Current branch: ' + $branch) }

$dirty = (git -C $repo status --porcelain) -join ''
if ($dirty.Trim()) { Write-ReceiptAndStop 'Repository has uncommitted changes. Deployment stopped.' }

$sha = (git -C $repo rev-parse HEAD).Trim()
if ($sha -notmatch '^[0-9a-f]{40}$') { Write-ReceiptAndStop 'Could not determine a 40-character commit SHA.' }

$distros = @(wsl.exe -l -q 2>$null | ForEach-Object { (($_ -replace ([char]0), '')).Trim() } | Where-Object { $_ })
if ($distros -notcontains $Distro) {
  if ($Distro -eq 'Ubuntu-24.04' -and $distros -contains 'Ubuntu') { $Distro = 'Ubuntu' }
  else { Write-ReceiptAndStop 'IZAKHONO owner-host Ubuntu is not installed.' }
}

Write-Host '[1/6] Preparing protected Venture Factory runtime secrets...' -ForegroundColor Cyan
$envText = ((& wsl.exe -d $Distro -u root -- bash -lc "if [ -f /etc/izakhono/apps/venture-factory.env ]; then cat /etc/izakhono/apps/venture-factory.env; fi") -join "
")
$ownerKey = Read-EnvValue $envText 'VENTURE_FACTORY_OWNER_KEY'
$aiInternalKey = Read-EnvValue $envText 'IZAKHONO_SUPER_AI_INTERNAL_KEY'
$aiWorkflowKey = Read-EnvValue $envText 'IZAKHONO_SUPER_AI_WORKFLOW_KEY'
$builderUrl = Read-EnvValue $envText 'IZAKHONO_BUILDER_URL'
$builderAdminKey = Read-EnvValue $envText 'IZAKHONO_BUILDER_ADMIN_KEY'
$customerMode = Read-EnvValue $envText 'VENTURE_FACTORY_CUSTOMER_MODE'
$idUrl = Read-EnvValue $envText 'IZAKHONO_ID_URL'
$idInternalKey = Read-EnvValue $envText 'IZAKHONO_ID_INTERNAL_KEY'
$accessUrl = Read-EnvValue $envText 'IZAKHONO_ACCESS_URL'
$accessInternalKey = Read-EnvValue $envText 'IZAKHONO_ACCESS_INTERNAL_KEY'
$payUrl = Read-EnvValue $envText 'IZAKHONO_PAY_URL'
$payApiKey = Read-EnvValue $envText 'IZAKHONO_PAY_API_KEY'
$priceMinor = Read-EnvValue $envText 'VENTURE_FACTORY_PRICE_MINOR'
$accessPlan = Read-EnvValue $envText 'VENTURE_FACTORY_ACCESS_PLAN'
$accessPeriodDays = Read-EnvValue $envText 'VENTURE_FACTORY_ACCESS_PERIOD_DAYS'
$publicOrigin = Read-EnvValue $envText 'VENTURE_FACTORY_PUBLIC_ORIGIN'

if (-not $ownerKey) { $ownerKey = New-HexSecret 32 }
if (-not $aiInternalKey) { $aiInternalKey = New-HexSecret 32 }
if (-not $aiWorkflowKey) { $aiWorkflowKey = New-HexSecret 32 }

if (-not [string]::IsNullOrWhiteSpace($env:IZAKHONO_BUILDER_URL)) {
  $builderUrl = $env:IZAKHONO_BUILDER_URL.Trim()
}
if (-not [string]::IsNullOrWhiteSpace($env:IZAKHONO_BUILDER_ADMIN_KEY)) {
  $builderAdminKey = $env:IZAKHONO_BUILDER_ADMIN_KEY.Trim()
}
if (-not $builderUrl) { $builderUrl = 'http://host.docker.internal:8787' }

if (-not [string]::IsNullOrWhiteSpace($env:VENTURE_FACTORY_CUSTOMER_MODE)) { $customerMode = $env:VENTURE_FACTORY_CUSTOMER_MODE.Trim().ToLowerInvariant() }
if (-not [string]::IsNullOrWhiteSpace($env:IZAKHONO_ID_URL)) { $idUrl = $env:IZAKHONO_ID_URL.Trim() }
if (-not [string]::IsNullOrWhiteSpace($env:IZAKHONO_ID_INTERNAL_KEY)) { $idInternalKey = $env:IZAKHONO_ID_INTERNAL_KEY.Trim() }
if (-not [string]::IsNullOrWhiteSpace($env:IZAKHONO_ACCESS_URL)) { $accessUrl = $env:IZAKHONO_ACCESS_URL.Trim() }
if (-not [string]::IsNullOrWhiteSpace($env:IZAKHONO_ACCESS_INTERNAL_KEY)) { $accessInternalKey = $env:IZAKHONO_ACCESS_INTERNAL_KEY.Trim() }
if (-not [string]::IsNullOrWhiteSpace($env:IZAKHONO_PAY_URL)) { $payUrl = $env:IZAKHONO_PAY_URL.Trim() }
if (-not [string]::IsNullOrWhiteSpace($env:IZAKHONO_PAY_API_KEY)) { $payApiKey = $env:IZAKHONO_PAY_API_KEY.Trim() }
if (-not [string]::IsNullOrWhiteSpace($env:VENTURE_FACTORY_PRICE_MINOR)) { $priceMinor = $env:VENTURE_FACTORY_PRICE_MINOR.Trim() }
if (-not [string]::IsNullOrWhiteSpace($env:VENTURE_FACTORY_ACCESS_PLAN)) { $accessPlan = $env:VENTURE_FACTORY_ACCESS_PLAN.Trim().ToLowerInvariant() }
if (-not [string]::IsNullOrWhiteSpace($env:VENTURE_FACTORY_ACCESS_PERIOD_DAYS)) { $accessPeriodDays = $env:VENTURE_FACTORY_ACCESS_PERIOD_DAYS.Trim() }
if (-not [string]::IsNullOrWhiteSpace($env:VENTURE_FACTORY_PUBLIC_ORIGIN)) { $publicOrigin = $env:VENTURE_FACTORY_PUBLIC_ORIGIN.Trim() }

if (-not $customerMode) { $customerMode = 'false' }
if (-not $idUrl) { $idUrl = 'http://host.docker.internal:9696' }
if (-not $accessUrl) { $accessUrl = 'http://host.docker.internal:9494' }
if (-not $priceMinor) { $priceMinor = '0' }
if (-not $accessPlan) { $accessPlan = 'monthly' }
if (-not $accessPeriodDays) { $accessPeriodDays = '30' }
if (-not $publicOrigin) { $publicOrigin = 'https://venture.izakhono.co.za' }

if ($customerMode -eq 'true') {
  $parsedPrice = 0
  [void][int]::TryParse($priceMinor, [ref]$parsedPrice)
  if (-not $idInternalKey -or -not $accessInternalKey -or -not $payUrl -or -not $payApiKey -or $parsedPrice -lt 100) {
    Write-ReceiptAndStop 'Customer mode was requested but IZAKHONO ID / ACCESS / PAY credentials and a price are not fully configured.'
  }
}

$payload = @(
  ('VENTURE_FACTORY_OWNER_KEY=' + $ownerKey)
  'IZAKHONO_SUPER_AI_URL=http://host.docker.internal:9595'
  ('IZAKHONO_SUPER_AI_INTERNAL_KEY=' + $aiInternalKey)
  ('IZAKHONO_SUPER_AI_WORKFLOW_KEY=' + $aiWorkflowKey)
  ('IZAKHONO_BUILDER_URL=' + $builderUrl)
  ('IZAKHONO_BUILDER_ADMIN_KEY=' + $builderAdminKey)
  ('VENTURE_FACTORY_CUSTOMER_MODE=' + $customerMode)
  ('IZAKHONO_ID_URL=' + $idUrl)
  ('IZAKHONO_ID_INTERNAL_KEY=' + $idInternalKey)
  ('IZAKHONO_ACCESS_URL=' + $accessUrl)
  ('IZAKHONO_ACCESS_INTERNAL_KEY=' + $accessInternalKey)
  'VENTURE_FACTORY_ACCESS_ENTITY_ID=izakhono-africa'
  ('IZAKHONO_PAY_URL=' + $payUrl)
  ('IZAKHONO_PAY_API_KEY=' + $payApiKey)
  'IZAKHONO_PAY_APP_SLUG=venture-factory'
  ('VENTURE_FACTORY_PRICE_MINOR=' + $priceMinor)
  ('VENTURE_FACTORY_ACCESS_PLAN=' + $accessPlan)
  ('VENTURE_FACTORY_ACCESS_PERIOD_DAYS=' + $accessPeriodDays)
  ('VENTURE_FACTORY_PUBLIC_ORIGIN=' + $publicOrigin)
  'VENTURE_FACTORY_PUBLIC_PLANNING=false'
) -join "`n"

$payload | & wsl.exe -d $Distro -u root -- bash -lc "install -d -m 700 /etc/izakhono/apps && umask 077 && cat > /etc/izakhono/apps/venture-factory.env && chmod 600 /etc/izakhono/apps/venture-factory.env"
if ($LASTEXITCODE -ne 0) { Write-ReceiptAndStop 'Could not create or refresh protected Venture Factory env file.' }

$env:IZAKHONO_AI_GATEWAY_INTERNAL_KEY = $aiInternalKey
$env:IZAKHONO_AI_WORKFLOW_KEY = $aiWorkflowKey
$env:IZAKHONO_AI_WORKFLOW_PRODUCTS = 'venture-factory,izakhono-builder'
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_OWNER_ONLY)) { $env:IZAKHONO_AI_OWNER_ONLY = 'true' }
if ([string]::IsNullOrWhiteSpace($env:IZAKHONO_AI_ALLOW_EXTERNAL)) { $env:IZAKHONO_AI_ALLOW_EXTERNAL = 'false' }

Write-Host '[2/6] Verifying SUPER AI owner runtime...' -ForegroundColor Cyan
$superAiState = 'FALLBACK'
$superAi = Join-Path $repo 'products\izakhono-ai-gateway\START-IZAKHONO-SUPER-AI-NODE01.ps1'
if (Test-Path $superAi) {
  try {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $superAi
    $aiHealth = Invoke-RestMethod -Uri 'http://127.0.0.1:9595/healthz' -TimeoutSec 5
    if ($aiHealth.ok -and $aiHealth.workflow_mode_configured) { $superAiState = 'VERIFIED' }
  } catch {
    Write-Warning 'SUPER AI did not pass. Venture Factory will remain usable through deterministic fallback.'
  }
}

Write-Host '[3/6] Activating owned Command Centre...' -ForegroundColor Cyan
$commandCentre = Join-Path $repo 'ACTIVATE-IZAKHONO-COMMAND-CENTRE.ps1'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $commandCentre -Distro $Distro
if ($LASTEXITCODE -ne 0) { Write-ReceiptAndStop 'IZAKHONO Command Centre activation failed.' }

Write-Host '[4/6] Reading owner deployment credential...' -ForegroundColor Cyan
$token = ((& wsl.exe -d $Distro -u root -- bash -lc 'cat /etc/izakhono/commands.owner-token') -join '').Trim()
if (-not $token) { Write-ReceiptAndStop 'Owner command credential is unavailable.' }

$headers = @{ 'x-admin-secret' = $token; 'content-type' = 'application/json' }
$body = @{ input = ('/deploy venture-factory ' + $sha) } | ConvertTo-Json -Compress

Write-Host '[5/6] Handing deployment to IZAKHONO CONTROL -> NODE...' -ForegroundColor Cyan
try {
  $deployment = Invoke-RestMethod -Uri 'http://127.0.0.1:8091/api/commands/run' -Method Post -Headers $headers -Body $body -TimeoutSec 40
} catch {
  Write-ReceiptAndStop ('Owned deployment request failed: ' + $_.Exception.Message)
}

$jobId = ''
try { $jobId = [string]$deployment.data.id } catch {}

Write-Host '[6/6] Waiting for local engine and owner-access verification...' -ForegroundColor Cyan
$healthText = ''
$localVerified = $false
$ownerAccessVerified = $false
$builderBridgeState = 'NOT_CONFIGURED'
$customerAccessState = 'DISABLED'
$checkoutState = 'NOT_CONFIGURED'
for ($i = 0; $i -lt 90; $i++) {
  try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:9780/healthz' -TimeoutSec 4
    if ($health.ok) {
      $healthText = ($health | ConvertTo-Json -Compress -Depth 8)
      if ($health.builder_bridge_configured) { $builderBridgeState = 'CONFIGURED' }
      if ($health.customer_mode) {
        $customerAccessState = if ($health.customer_stack_configured) { 'CONFIGURED' } else { 'INCOMPLETE' }
        $checkoutState = if ($health.checkout_configured) { 'CONFIGURED' } else { 'NOT_CONFIGURED' }
      }
      $localVerified = $true
      break
    }
  } catch {}
  Start-Sleep -Seconds 2
}

if ($localVerified) {
  try {
    $planHeaders = @{ 'x-venture-factory-key' = $ownerKey }
    $plans = Invoke-RestMethod -Uri 'http://127.0.0.1:9780/api/plans?limit=1' -Headers $planHeaders -TimeoutSec 5
    if ($plans.ok) { $ownerAccessVerified = $true }
  } catch {}
}

$desktop = [Environment]::GetFolderPath('Desktop')
$receipt = Join-Path $desktop 'IZAKHONO-VENTURE-FACTORY-DEPLOYMENT.txt'
$localState = if ($localVerified) { 'VERIFIED' } else { 'UNVERIFIED' }
$ownerState = if ($ownerAccessVerified) { 'VERIFIED' } else { 'UNVERIFIED' }
@(
  'IZAKHONO VENTURE FACTORY DEPLOYMENT'
  ('Generated: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss K'))
  ('COMMIT_SHA=' + $sha)
  ('DEPLOYMENT_ACCEPTED=' + [string][bool]$deployment.ok)
  ('DEPLOYMENT_JOB_ID=' + $jobId)
  ('CONTROL_MESSAGE=' + [string]$deployment.message)
  ('SUPER_AI_WORKFLOW=' + $superAiState)
  ('LOCAL_HEALTH=' + $localState)
  ('OWNER_ACCESS=' + $ownerState)
  ('BUILDER_BRIDGE=' + $builderBridgeState)
  ('CUSTOMER_ACCESS=' + $customerAccessState)
  ('CHECKOUT=' + $checkoutState)
  ('LOCAL_HEALTH_RESPONSE=' + $healthText)
  'SECRETS_FILE=/etc/izakhono/apps/venture-factory.env'
  'SECRETS_NOT_PRINTED=true'
  'PUBLIC_HTTPS=UNVERIFIED'
  'PUBLIC_LIVE_NOT_CLAIMED=true'
  'NEXT_GATE=EDGE_TLS_DNS_AND_VERIFIED_EXPERIENCE'
) | Set-Content -Path $receipt -Encoding UTF8

Write-Host ''
if ($localVerified -and $ownerAccessVerified) {
  Write-Host '[PASS] Venture Factory owner runtime and protected owner API are verified locally.' -ForegroundColor Green
} elseif ($localVerified) {
  Write-Warning 'Local runtime is healthy, but protected owner API verification did not pass.'
} else {
  Write-Warning 'Deployment was accepted but local health is not yet verified.'
}
Write-Host ('SUPER AI workflow: ' + $superAiState)
Write-Host ('Builder bridge: ' + $builderBridgeState)
Write-Host ('Customer access: ' + $customerAccessState)
Write-Host ('Checkout: ' + $checkoutState)
Write-Host ('Receipt: ' + $receipt)
Write-Host 'Public-live status remains UNVERIFIED until EDGE/TLS/DNS and the actual experience are proven.'
