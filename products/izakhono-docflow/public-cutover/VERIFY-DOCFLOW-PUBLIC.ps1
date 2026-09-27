#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Hostname,
  [Parameter(Mandatory=$true)][string]$FallbackUrl
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Continue'

function Assert-Hostname([string]$Value) {
  if ($Value -notmatch '^(?=.{4,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$') {
    throw "Invalid hostname: $Value"
  }
}
Assert-Hostname $Hostname
if($FallbackUrl -notmatch '^https://'){ throw 'FallbackUrl must be HTTPS.' }

$item=[ordered]@{
  schema='izakhono.docflow.public_verify.v1'
  generated_at=(Get-Date).ToUniversalTime().ToString('o')
  hostname=$Hostname
  dns=$false
  tcp443=$false
  https_health=$false
  https_ready=$false
  homepage=$false
  fallback=$false
  certificate=$null
  overall='NOT_READY_KEEP_EXTERNAL'
}

try {
  $dns=Resolve-DnsName -Name $Hostname -ErrorAction Stop | Where-Object {$_.Type -in @('A','AAAA')}
  $item.dns=[bool]$dns
  $item.dns_answers=@($dns | ForEach-Object {$_.IPAddress})
} catch {$item.dns_error=$_.Exception.Message}

try {
  $tcp=Test-NetConnection -ComputerName $Hostname -Port 443 -WarningAction SilentlyContinue
  $item.tcp443=[bool]$tcp.TcpTestSucceeded
} catch {$item.tcp_error=$_.Exception.Message}

try {
  $r=Invoke-RestMethod -Uri ("https://"+$Hostname+"/api/health") -TimeoutSec 15
  $item.https_health=[bool]$r.ok
  $item.health=$r
} catch {$item.health_error=$_.Exception.Message}

try {
  $r=Invoke-RestMethod -Uri ("https://"+$Hostname+"/api/ready") -TimeoutSec 15
  $item.https_ready=([bool]$r.ok -and $r.database -eq 'ready' -and [bool]$r.owner_secret_configured)
  $item.ready=$r
} catch {$item.ready_error=$_.Exception.Message}

try {
  $r=Invoke-WebRequest -Uri ("https://"+$Hostname+"/") -UseBasicParsing -TimeoutSec 15
  $item.homepage=($r.StatusCode -ge 200 -and $r.StatusCode -lt 400 -and $r.Content -match 'IZAKHONO DOCFLOW')
  $item.homepage_status=$r.StatusCode
} catch {$item.homepage_error=$_.Exception.Message}

try {
  $r=Invoke-WebRequest -Uri $FallbackUrl -UseBasicParsing -TimeoutSec 15
  $item.fallback=($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
  $item.fallback_status=$r.StatusCode
} catch {$item.fallback_error=$_.Exception.Message}

try {
  $tcp=New-Object Net.Sockets.TcpClient($Hostname,443)
  $ssl=New-Object Net.Security.SslStream($tcp.GetStream(),$false,({$true}))
  $ssl.AuthenticateAsClient($Hostname)
  $cert=New-Object Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
  $item.certificate=[ordered]@{
    subject=$cert.Subject
    issuer=$cert.Issuer
    not_before=$cert.NotBefore.ToUniversalTime().ToString('o')
    not_after=$cert.NotAfter.ToUniversalTime().ToString('o')
  }
  $ssl.Dispose();$tcp.Dispose()
} catch {$item.certificate_error=$_.Exception.Message}

$pass=($item.dns -and $item.tcp443 -and $item.https_health -and $item.https_ready -and $item.homepage -and $item.fallback -and $null -ne $item.certificate)
if($pass){ $item.overall='OWNED_PUBLIC_GATES_PASS' }

$desktop=[Environment]::GetFolderPath('Desktop')
$path=Join-Path $desktop 'IZAKHONO-DOCFLOW-PUBLIC-VERIFY.json'
$item | ConvertTo-Json -Depth 8 | Set-Content -Path $path -Encoding UTF8
$item | ConvertTo-Json -Depth 8
Write-Host "Report: $path"
if(-not $pass){ exit 1 }
