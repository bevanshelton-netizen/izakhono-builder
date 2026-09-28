#requires -Version 5.1
[CmdletBinding()]
param(
 [Parameter(Mandatory=$true)][string]$Hostname,
 [Parameter(Mandatory=$true)][string]$FallbackUrl
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Continue'
if($FallbackUrl -notmatch '^https://'){throw 'FallbackUrl must be HTTPS.'}
$item=[ordered]@{schema='izakhono.sign.public_verify.v1';generated_at=(Get-Date).ToUniversalTime().ToString('o');hostname=$Hostname;dns=$false;tcp443=$false;https_health=$false;landing=$false;fallback=$false;certificate=$null;overall='NOT_READY_KEEP_EXTERNAL'}
try{$dns=Resolve-DnsName -Name $Hostname -ErrorAction Stop|Where-Object{$_.Type -in @('A','AAAA')};$item.dns=[bool]$dns;$item.dns_answers=@($dns|% IPAddress)}catch{$item.dns_error=$_.Exception.Message}
try{$tcp=Test-NetConnection -ComputerName $Hostname -Port 443 -WarningAction SilentlyContinue;$item.tcp443=[bool]$tcp.TcpTestSucceeded}catch{$item.tcp_error=$_.Exception.Message}
try{$h=Invoke-RestMethod -Uri ("https://"+$Hostname+"/healthz") -TimeoutSec 15;$item.https_health=[bool]$h.ok}catch{$item.health_error=$_.Exception.Message}
try{$p=Invoke-WebRequest -Uri ("https://"+$Hostname+"/") -UseBasicParsing -TimeoutSec 15;$item.landing=($p.StatusCode -eq 200 -and $p.Content -match 'IZAKHONO SIGN')}catch{$item.landing_error=$_.Exception.Message}
try{$f=Invoke-WebRequest -Uri $FallbackUrl -UseBasicParsing -TimeoutSec 15;$item.fallback=($f.StatusCode -ge 200 -and $f.StatusCode -lt 400)}catch{$item.fallback_error=$_.Exception.Message}
try{$tcp=New-Object Net.Sockets.TcpClient($Hostname,443);$ssl=New-Object Net.Security.SslStream($tcp.GetStream(),$false,({$true}));$ssl.AuthenticateAsClient($Hostname);$cert=New-Object Security.Cryptography.X509Certificates.X509Certificate2($ssl.RemoteCertificate);$item.certificate=[ordered]@{subject=$cert.Subject;issuer=$cert.Issuer;not_before=$cert.NotBefore.ToUniversalTime().ToString('o');not_after=$cert.NotAfter.ToUniversalTime().ToString('o')};$ssl.Dispose();$tcp.Dispose()}catch{$item.certificate_error=$_.Exception.Message}
$pass=($item.dns -and $item.tcp443 -and $item.https_health -and $item.landing -and $item.fallback -and $null -ne $item.certificate)
if($pass){$item.overall='OWNED_PUBLIC_GATES_PASS'}
$path=Join-Path ([Environment]::GetFolderPath('Desktop')) 'IZAKHONO-SIGN-PUBLIC-VERIFY.json'
$item|ConvertTo-Json -Depth 8|Set-Content $path -Encoding UTF8
$item|ConvertTo-Json -Depth 8
Write-Host "Report: $path"
if(-not $pass){exit 1}
