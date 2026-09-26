#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Hostname = 'venture.izakhono.co.za',
  [string]$FallbackUrl = 'https://ai.izakhono.co.za/venture-factory'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Continue'

$result = [ordered]@{
  schema = 'izakhono.venture-factory.public-verify.v1'
  generated_at = (Get-Date).ToUniversalTime().ToString('o')
  hostname = $Hostname
  dns = $false
  tcp443 = $false
  https_health = $false
  homepage = $false
  certificate = $null
  fallback_url = $FallbackUrl
  fallback = $false
  owned_live_verified = $false
}

try {
  $dns = Resolve-DnsName -Name $Hostname -ErrorAction Stop | Where-Object { $_.Type -in @('A','AAAA') }
  $result.dns = [bool]$dns
  $result.dns_answers = @($dns | ForEach-Object { $_.IPAddress })
} catch { $result.dns_error = $_.Exception.Message }

try {
  $tcp = Test-NetConnection -ComputerName $Hostname -Port 443 -WarningAction SilentlyContinue
  $result.tcp443 = [bool]$tcp.TcpTestSucceeded
} catch { $result.tcp_error = $_.Exception.Message }

try {
  $health = Invoke-RestMethod -Uri ('https://' + $Hostname + '/healthz') -TimeoutSec 15
  $result.https_health = [bool]$health.ok
  $result.health = $health
} catch { $result.health_error = $_.Exception.Message }

try {
  $page = Invoke-WebRequest -Uri ('https://' + $Hostname + '/') -UseBasicParsing -TimeoutSec 15
  $body = [string]$page.Content
  $result.homepage = ($page.StatusCode -ge 200 -and $page.StatusCode -lt 400 -and $body.Contains('IZAKHONO VENTURE FACTORY'))
  $result.homepage_status = $page.StatusCode
} catch { $result.homepage_error = $_.Exception.Message }

try {
  $client = New-Object Net.Sockets.TcpClient($Hostname,443)
  $ssl = New-Object Net.Security.SslStream($client.GetStream(),$false,({$true}))
  $ssl.AuthenticateAsClient($Hostname)
  $cert = New-Object Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
  $result.certificate = [ordered]@{
    subject = $cert.Subject
    issuer = $cert.Issuer
    not_after = $cert.NotAfter.ToUniversalTime().ToString('o')
  }
  $ssl.Dispose(); $client.Dispose()
} catch { $result.certificate_error = $_.Exception.Message }

if ($FallbackUrl) {
  try {
    $fallback = Invoke-WebRequest -Uri $FallbackUrl -UseBasicParsing -TimeoutSec 15
    $result.fallback = ($fallback.StatusCode -ge 200 -and $fallback.StatusCode -lt 400)
    $result.fallback_status = $fallback.StatusCode
  } catch { $result.fallback_error = $_.Exception.Message }
}

$result.owned_live_verified = [bool](
  $result.dns -and
  $result.tcp443 -and
  $result.https_health -and
  $result.homepage -and
  $result.certificate -and
  $result.fallback
)

$result.overall = if ($result.owned_live_verified) { 'OWNED_LIVE_VERIFIED' } else { 'NOT_READY_KEEP_FALLBACK' }

$desktop = [Environment]::GetFolderPath('Desktop')
$path = Join-Path $desktop 'IZAKHONO-VENTURE-FACTORY-PUBLIC-VERIFY.json'
$result | ConvertTo-Json -Depth 10 | Set-Content -Path $path -Encoding UTF8
$result | ConvertTo-Json -Depth 10
Write-Host ('Report: ' + $path)

if (-not $result.owned_live_verified) { exit 1 }
