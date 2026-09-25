#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Hostname,
  [Parameter(Mandatory=$true)][string]$ExternalFallback,
  [string]$Report = (Join-Path ([Environment]::GetFolderPath("Desktop")) "IZAKHONO-DIGITAL-FINANCE-PUBLIC-VERIFY.json")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($Hostname -match '^https?://') { throw "Pass a hostname only, not a URL." }
$Owned = "https://$Hostname"
$Result = [ordered]@{
  schema = "izakhono.digital.finance.public.verify.v1"
  hostname = $Hostname
  owned_url = $Owned
  external_fallback = $ExternalFallback
  checked_at = (Get-Date).ToUniversalTime().ToString("o")
  gates = [ordered]@{}
  status = "NOT_YET_PUBLIC"
}

function Probe([string]$Url) {
  try {
    $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
    return @{ ok = ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400); status = [int]$r.StatusCode; content = $r.Content }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    return @{ ok = $false; status = $code; error = $_.Exception.GetType().Name }
  }
}

try {
  $dns = Resolve-DnsName -Name $Hostname -ErrorAction Stop | Where-Object { $_.Type -in @("A","AAAA") }
  $Result.gates.dns = @{ ok = [bool]$dns; records = @($dns | ForEach-Object { $_.IPAddress }) }
} catch {
  $Result.gates.dns = @{ ok = $false; error = $_.Exception.Message }
}

$health = Probe "$Owned/healthz"
$home = Probe "$Owned/"
$status = Probe "$Owned/api/v1/status"
$fallback = Probe $ExternalFallback

$Result.gates.https_health = @{ ok = ($health.ok -and $health.content.Trim() -eq "OK"); status = $health.status }
$Result.gates.product_root = @{ ok = ($home.ok -and $home.content -match "IZAKHONO DIGITAL FINANCE"); status = $home.status }
$Result.gates.status_api = @{ ok = ($status.ok -and $status.content -match "izakhono-digital-finance"); status = $status.status }
$Result.gates.external_fallback = @{ ok = $fallback.ok; status = $fallback.status }

$tcp = Test-NetConnection -ComputerName $Hostname -Port 443 -WarningAction SilentlyContinue
$Result.gates.tcp443 = @{ ok = [bool]$tcp.TcpTestSucceeded }

$all = @(
  $Result.gates.dns.ok,
  $Result.gates.https_health.ok,
  $Result.gates.product_root.ok,
  $Result.gates.status_api.ok,
  $Result.gates.external_fallback.ok,
  $Result.gates.tcp443.ok
) -notcontains $false

if ($all) {
  $Result.status = "OWNED LIVE VERIFIED CANDIDATE"
}

$Result | ConvertTo-Json -Depth 8 | Set-Content -Path $Report -Encoding UTF8
$Result | ConvertTo-Json -Depth 8

if (-not $all) {
  Write-Host "[SAFE STOP] Owned public acceptance did not pass. Keep the verified external fallback active."
  exit 1
}

Write-Host "[PASS] DNS/TLS/HTTPS/product/fallback checks passed from this external vantage."
Write-Host "Review backup/restore/rollback and secrets evidence before changing the platform manifest to OWNED LIVE VERIFIED."
