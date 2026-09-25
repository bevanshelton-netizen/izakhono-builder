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
    'PUBLIC_HTTPS=UNVERIFIED'
    ('DETAIL=' + $Message)
  ) | Set-Content -Path $receipt -Encoding UTF8
  throw $Message
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

$superAi = Join-Path $repo 'products\izakhono-ai-gateway\START-IZAKHONO-SUPER-AI-NODE01.ps1'
if (Test-Path $superAi) {
  Write-Host '[1/4] Verifying SUPER AI owner runtime...' -ForegroundColor Cyan
  try { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $superAi } catch {
    Write-Warning 'SUPER AI bootstrap did not pass. Venture Factory can still use deterministic fallback.'
  }
}

Write-Host '[2/4] Activating owned Command Centre...' -ForegroundColor Cyan
$commandCentre = Join-Path $repo 'ACTIVATE-IZAKHONO-COMMAND-CENTRE.ps1'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $commandCentre -Distro $Distro
if ($LASTEXITCODE -ne 0) { Write-ReceiptAndStop 'IZAKHONO Command Centre activation failed.' }

Write-Host '[3/4] Reading owner deployment credential...' -ForegroundColor Cyan
$token = ((& wsl.exe -d $Distro -u root -- bash -lc 'cat /etc/izakhono/commands.owner-token') -join '').Trim()
if (-not $token) { Write-ReceiptAndStop 'Owner command credential is unavailable.' }

$headers = @{ 'x-admin-secret' = $token; 'content-type' = 'application/json' }
$body = @{ input = ('/deploy venture-factory ' + $sha) } | ConvertTo-Json -Compress

Write-Host '[4/4] Handing deployment to IZAKHONO CONTROL -> NODE...' -ForegroundColor Cyan
try {
  $deployment = Invoke-RestMethod -Uri 'http://127.0.0.1:8091/api/commands/run' -Method Post -Headers $headers -Body $body -TimeoutSec 40
} catch {
  Write-ReceiptAndStop ('Owned deployment request failed: ' + $_.Exception.Message)
}

Start-Sleep -Seconds 3
$healthText = ''
$localVerified = $false
try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:9780/healthz' -TimeoutSec 5
  $healthText = ($health | ConvertTo-Json -Compress -Depth 8)
  $localVerified = [bool]$health.ok
} catch {
  $healthText = 'UNREACHABLE: ' + $_.Exception.Message
}

$desktop = [Environment]::GetFolderPath('Desktop')
$receipt = Join-Path $desktop 'IZAKHONO-VENTURE-FACTORY-DEPLOYMENT.txt'
$localState = if ($localVerified) { 'VERIFIED' } else { 'UNVERIFIED' }
@(
  'IZAKHONO VENTURE FACTORY DEPLOYMENT'
  ('Generated: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss K'))
  ('COMMIT_SHA=' + $sha)
  ('DEPLOYMENT_ACCEPTED=' + [string][bool]$deployment.ok)
  ('CONTROL_MESSAGE=' + [string]$deployment.message)
  ('LOCAL_HEALTH=' + $localState)
  ('LOCAL_HEALTH_RESPONSE=' + $healthText)
  'PUBLIC_HTTPS=UNVERIFIED'
  'PUBLIC_LIVE_NOT_CLAIMED=true'
  'NEXT_GATE=EDGE_TLS_DNS_AND_VERIFIED_EXPERIENCE'
) | Set-Content -Path $receipt -Encoding UTF8

Write-Host ''
if ($localVerified) {
  Write-Host '[PASS] Venture Factory owner runtime is responding locally.' -ForegroundColor Green
} else {
  Write-Warning 'Deployment was accepted but local health is not yet verified.'
}
Write-Host ('Receipt: ' + $receipt)
Write-Host 'Public-live status remains UNVERIFIED until EDGE/TLS/DNS and the actual experience are proven.'
