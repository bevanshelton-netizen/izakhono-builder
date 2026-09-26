#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$AllegroHostname = 'allegro.izakhonoafrica.co.za',
  [string]$Fallback = 'https://allegro-vibez-79622wjli-bevan2.vercel.app'
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Continue'
$item=[ordered]@{
  slug='allegro-vibez';hostname=$AllegroHostname;dns=$false;tcp443=$false;
  https_health=$false;identity=$false;fallback=$false;certificate=$null
}

try {
  $dns=Resolve-DnsName -Name $AllegroHostname -ErrorAction Stop | Where-Object {$_.Type -in @('A','AAAA')}
  $item.dns=[bool]$dns
  $item.dns_answers=@($dns | ForEach-Object {$_.IPAddress})
} catch {$item.dns_error=$_.Exception.Message}

try {
  $tcp=Test-NetConnection -ComputerName $AllegroHostname -Port 443 -WarningAction SilentlyContinue
  $item.tcp443=[bool]$tcp.TcpTestSucceeded
} catch {$item.tcp_error=$_.Exception.Message}

try {
  $r=Invoke-WebRequest -Uri ("https://"+$AllegroHostname+"/healthz") -UseBasicParsing -TimeoutSec 15
  $item.https_health=($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
  $item.health_status=$r.StatusCode
} catch {$item.health_error=$_.Exception.Message}

try {
  $r=Invoke-WebRequest -Uri ("https://"+$AllegroHostname+"/") -UseBasicParsing -TimeoutSec 15
  $item.identity=($r.StatusCode -eq 200 -and $r.Content -match 'ALLEGRO')
  $item.identity_status=$r.StatusCode
} catch {$item.identity_error=$_.Exception.Message}

try {
  $r=Invoke-WebRequest -Uri $Fallback -UseBasicParsing -TimeoutSec 15
  $item.fallback=($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
  $item.fallback_status=$r.StatusCode
} catch {$item.fallback_error=$_.Exception.Message}

try {
  $tcp=New-Object Net.Sockets.TcpClient($AllegroHostname,443)
  $ssl=New-Object Net.Security.SslStream($tcp.GetStream(),$false,({$true}))
  $ssl.AuthenticateAsClient($AllegroHostname)
  $cert=New-Object Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
  $item.certificate=[ordered]@{subject=$cert.Subject;issuer=$cert.Issuer;not_after=$cert.NotAfter.ToUniversalTime().ToString('o')}
  $ssl.Dispose();$tcp.Dispose()
} catch {$item.certificate_error=$_.Exception.Message}

$pass=$item.dns -and $item.tcp443 -and $item.https_health -and $item.identity -and $item.fallback -and $item.certificate
$report=[ordered]@{
  schema='izakhono.allegro.public-cutover.verify.v1'
  generated_at=(Get-Date).ToUniversalTime().ToString('o')
  overall=$(if($pass){'OWNED_PUBLIC_GATES_PASS'}else{'NOT_READY_KEEP_EXTERNAL'})
  external_route_changed=$false
  result=[pscustomobject]$item
}
$path=Join-Path ([Environment]::GetFolderPath('Desktop')) 'IZAKHONO-ALLEGRO-PUBLIC-VERIFY.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -Path $path -Encoding UTF8
$report | ConvertTo-Json -Depth 8
Write-Host "Report: $path"
if(-not $pass){ exit 1 }
