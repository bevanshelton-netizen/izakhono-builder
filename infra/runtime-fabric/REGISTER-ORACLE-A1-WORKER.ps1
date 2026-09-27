param(
  [Parameter(Mandatory=$true)]
  [string]$HostName,

  [string]$SshUser = "ubuntu",

  [int]$SshPort = 22
)

$ErrorActionPreference = "Stop"

if ($HostName -notmatch '^[A-Za-z0-9.-]+  throw "HostName contains unsupported characters."
}
if ($SshUser -notmatch '^[A-Za-z0-9._-]+$') {
  throw "SshUser contains unsupported characters."
}
if ($SshPort -lt 1 -or $SshPort -gt 65535) {
  throw "SshPort is out of range."
}
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "OpenSSH client is required."
}

$RegistryDir = Join-Path $env:LOCALAPPDATA "Izakhono\RuntimeFabric"
$RegistryFile = Join-Path $RegistryDir "oracle-a1-worker.json"
New-Item -ItemType Directory -Force -Path $RegistryDir | Out-Null

$target = "$SshUser@$HostName"
$remoteCommand = "curl -fsS http://127.0.0.1:9808/healthz"
$sshArgs = @(
  "-p", [string]$SshPort,
  "-o", "BatchMode=yes",
  "-o", "ConnectTimeout=8",
  "-o", "StrictHostKeyChecking=accept-new",
  $target,
  $remoteCommand
)

Write-Host "Verifying Oracle A1 auxiliary worker over SSH..." -ForegroundColor Cyan
Write-Host "Target: $target"
Write-Host "Public application traffic will NOT be enabled by this registration."

$output = & ssh @sshArgs

if ($LASTEXITCODE -ne 0) {
  throw "Remote worker health check failed over SSH."
}

try {
  $health = $output | ConvertFrom-Json
} catch {
  throw "Remote worker returned invalid health JSON."
}

if (-not $health.ok) {
  throw "Remote worker did not report ok."
}
if ($health.runtime_class -ne "EXTERNAL-AUX-ORACLE-A1") {
  throw "Remote worker runtime_class is not EXTERNAL-AUX-ORACLE-A1."
}
if ($health.public_traffic -ne $false) {
  throw "Auxiliary worker unexpectedly reports public_traffic=true."
}

$record = [ordered]@{
  runtime_class = "EXTERNAL-AUX-ORACLE-A1"
  host = $HostName
  ssh_user = $SshUser
  ssh_port = $SshPort
  health_transport = "ssh-loopback"
  health_endpoint = "http://127.0.0.1:9808/healthz"
  public_traffic = $false
  registered_at_utc = [DateTime]::UtcNow.ToString("o")
  last_verified_at_utc = [DateTime]::UtcNow.ToString("o")
  live_claim = $false
}

$record | ConvertTo-Json -Depth 5 | Set-Content -Path $RegistryFile -Encoding UTF8

Write-Host ""
Write-Host "Oracle A1 auxiliary worker verified and registered locally." -ForegroundColor Green
Write-Host "Registry: $RegistryFile"
Write-Host "Status: auxiliary only; no public-live claim."
) {
  throw "HostName contains unsupported characters."
}
if ($SshUser -notmatch '^[A-Za-z0-9._-]+$') {
  throw "SshUser contains unsupported characters."
}
if ($SshPort -lt 1 -or $SshPort -gt 65535) {
  throw "SshPort is out of range."
}
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
  throw "OpenSSH client is required."
}

$RegistryDir = Join-Path $env:LOCALAPPDATA "Izakhono\RuntimeFabric"
$RegistryFile = Join-Path $RegistryDir "oracle-a1-worker.json"
New-Item -ItemType Directory -Force -Path $RegistryDir | Out-Null

$target = "$SshUser@$HostName"
$remoteCommand = "curl -fsS http://127.0.0.1:9808/healthz"
$sshArgs = @(
  "-p", [string]$SshPort,
  "-o", "BatchMode=yes",
  "-o", "ConnectTimeout=8",
  "-o", "StrictHostKeyChecking=accept-new",
  $target,
  $remoteCommand
)

Write-Host "Verifying Oracle A1 auxiliary worker over SSH..." -ForegroundColor Cyan
Write-Host "Target: $target"
Write-Host "Public application traffic will NOT be enabled by this registration."

$output = & ssh @sshArgs

if ($LASTEXITCODE -ne 0) {
  throw "Remote worker health check failed over SSH."
}

try {
  $health = $output | ConvertFrom-Json
} catch {
  throw "Remote worker returned invalid health JSON."
}

if (-not $health.ok) {
  throw "Remote worker did not report ok."
}
if ($health.runtime_class -ne "EXTERNAL-AUX-ORACLE-A1") {
  throw "Remote worker runtime_class is not EXTERNAL-AUX-ORACLE-A1."
}
if ($health.public_traffic -ne $false) {
  throw "Auxiliary worker unexpectedly reports public_traffic=true."
}

$record = [ordered]@{
  runtime_class = "EXTERNAL-AUX-ORACLE-A1"
  host = $HostName
  ssh_user = $SshUser
  ssh_port = $SshPort
  health_transport = "ssh-loopback"
  health_endpoint = "http://127.0.0.1:9808/healthz"
  public_traffic = $false
  registered_at_utc = [DateTime]::UtcNow.ToString("o")
  last_verified_at_utc = [DateTime]::UtcNow.ToString("o")
  live_claim = $false
}

$record | ConvertTo-Json -Depth 5 | Set-Content -Path $RegistryFile -Encoding UTF8

Write-Host ""
Write-Host "Oracle A1 auxiliary worker verified and registered locally." -ForegroundColor Green
Write-Host "Registry: $RegistryFile"
Write-Host "Status: auxiliary only; no public-live claim."
