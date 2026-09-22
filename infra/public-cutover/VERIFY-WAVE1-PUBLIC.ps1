#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$AllegroHostname,
  [Parameter(Mandatory=$true)][string]$ChancellorHostname
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Continue'
$results=@()

function Test-Owned([string]$Slug,[string]$Host,[string]$Health,[string]$Fallback,[string]$Readiness='') {
  $item=[ordered]@{slug=$Slug;hostname=$Host;dns=$false;tcp443=$false;https_health=$false;fallback=$false;readiness=$null;certificate=$null}
  try {
    $dns=Resolve-DnsName -Name $Host -ErrorAction Stop | Where-Object {$_.Type -in @('A','AAAA')}
    $item.dns=[bool]$dns
    $item.dns_answers=@($dns | ForEach-Object {$_.IPAddress})
  } catch {$item.dns_error=$_.Exception.Message}

  try {
    $tcp=Test-NetConnection -ComputerName $Host -Port 443 -WarningAction SilentlyContinue
    $item.tcp443=[bool]$tcp.TcpTestSucceeded
  } catch {$item.tcp_error=$_.Exception.Message}

  try {
    $r=Invoke-WebRequest -Uri ("https://"+$Host+$Health) -UseBasicParsing -TimeoutSec 15
    $item.https_health=($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
    $item.health_status=$r.StatusCode
  } catch {$item.health_error=$_.Exception.Message}

  if($Readiness){
    try{
      $ready=Invoke-RestMethod -Uri ("https://"+$Host+$Readiness) -TimeoutSec 15
      $item.readiness=$ready
    } catch {$item.readiness_error=$_.Exception.Message}
  }

  try {
    $r=Invoke-WebRequest -Uri $Fallback -UseBasicParsing -TimeoutSec 15
    $item.fallback=($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
    $item.fallback_status=$r.StatusCode
  } catch {$item.fallback_error=$_.Exception.Message}

  try {
    $tcp=New-Object Net.Sockets.TcpClient($Host,443)
    $ssl=New-Object Net.Security.SslStream($tcp.GetStream(),$false,({$true}))
    $ssl.AuthenticateAsClient($Host)
    $cert=New-Object Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate)
    $item.certificate=[ordered]@{subject=$cert.Subject;issuer=$cert.Issuer;not_after=$cert.NotAfter.ToUniversalTime().ToString('o')}
    $ssl.Dispose();$tcp.Dispose()
  } catch {$item.certificate_error=$_.Exception.Message}

  return [pscustomobject]$item
}

$results += Test-Owned 'allegro-vibez' $AllegroHostname '/healthz' 'https://allegro-vibez-79622wjli-bevan2.vercel.app'
$results += Test-Owned 'the-chancellor' $ChancellorHostname '/api/health' 'https://the-chancellor-e07wn6vc4-bevan2.vercel.app' '/api/go-live'

$pass=$true
foreach($r in $results){
  if(-not ($r.dns -and $r.tcp443 -and $r.https_health -and $r.fallback)){ $pass=$false }
}
$ch=$results | Where-Object {$_.slug -eq 'the-chancellor'}
if($ch.readiness -and $ch.readiness.PSObject.Properties.Name -contains 'readyForPaidTraffic'){
  if(-not [bool]$ch.readiness.readyForPaidTraffic){ $pass=$false }
}else{$pass=$false}

$report=[ordered]@{
  schema='izakhono.public-cutover.verify.v1'
  generated_at=(Get-Date).ToUniversalTime().ToString('o')
  wave=1
  overall= $(if($pass){'OWNED_PUBLIC_GATES_PASS'}else{'NOT_READY_KEEP_EXTERNAL'})
  external_routes_changed=$false
  results=$results
}
$path=Join-Path ([Environment]::GetFolderPath('Desktop')) 'IZAKHONO-WAVE1-PUBLIC-VERIFY.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -Path $path -Encoding UTF8
$report | ConvertTo-Json -Depth 8
Write-Host "Report: $path"
if(-not $pass){ exit 1 }
