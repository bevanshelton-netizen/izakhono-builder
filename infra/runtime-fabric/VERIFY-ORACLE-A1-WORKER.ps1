$ErrorActionPreference = "Stop"

$RegistryFile = Join-Path $env:LOCALAPPDATA "Izakhono\RuntimeFabric\oracle-a1-worker.json"

if (-not (Test-Path $RegistryFile)) {
  throw "No Oracle A1 auxiliary worker is registered on this Windows user profile."
}
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "OpenSSH client is required."
}

$record = Get-Content -Raw $RegistryFile | ConvertFrom-Json
$target = "$($record.ssh_user)@$($record.host)"
$remoteCommand = "curl -fsS http://127.0.0.1:9808/healthz"
$sshArgs = @(
  "-p", [string]$record.ssh_port,
  "-o", "BatchMode=yes",
  "-o", "ConnectTimeout=8",
  "-o", "StrictHostKeyChecking=accept-new",
  $target,
  $remoteCommand
)

$output = & ssh @sshArgs

if ($LASTEXITCODE -ne 0) {
  throw "Registered Oracle A1 worker failed health verification."
}

$health = $output | ConvertFrom-Json
if (-not $health.ok -or $health.runtime_class -ne "EXTERNAL-AUX-ORACLE-A1") {
  throw "Registered Oracle A1 worker returned an unexpected health response."
}
if ($health.public_traffic -ne $false) {
  throw "Registered Oracle A1 worker unexpectedly reports public_traffic=true."
}

$record.last_verified_at_utc = [DateTime]::UtcNow.ToString("o")
$record.public_traffic = $false
$record.live_claim = $false
$record | ConvertTo-Json -Depth 5 | Set-Content -Path $RegistryFile -Encoding UTF8

Write-Host "Oracle A1 auxiliary worker verification passed." -ForegroundColor Green
Write-Host "No public-live claim was made."
