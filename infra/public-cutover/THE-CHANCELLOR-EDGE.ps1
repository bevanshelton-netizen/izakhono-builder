#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Hostname,
  [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

if($Hostname -notmatch '^(?=.{4,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$'){
  throw "Invalid hostname: $Hostname"
}

$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$generated=Join-Path $PSScriptRoot 'generated'
$sites=Join-Path $root 'infra\launch-stack\sites'
$compose=Join-Path $root 'infra\launch-stack\docker-compose.yml'
$staged=Join-Path $generated '20-the-chancellor.caddy'
$live=Join-Path $sites '20-the-chancellor.caddy'
$localHealth='http://127.0.0.1:3000/api/health'
$localReady='http://127.0.0.1:3000/api/go-live'
$fallback='https://the-chancellor.vercel.app/'

New-Item -ItemType Directory -Force -Path $generated | Out-Null

try { Invoke-WebRequest -Uri $localHealth -UseBasicParsing -TimeoutSec 8 | Out-Null }
catch { throw "NODE01 Chancellor health failed: $localHealth" }

$body=@"
$Hostname {
  encode zstd gzip
  reverse_proxy host.docker.internal:3000
}
"@
Set-Content -Path $staged -Value $body -Encoding UTF8
Write-Host "[STAGED] $staged" -ForegroundColor Green
Write-Host "Owned hostname: $Hostname"
Write-Host "Upstream: host.docker.internal:3000"

if(-not $Apply){
  Write-Host ''
  Write-Host '[DRY RUN PASS] No public EDGE change made.' -ForegroundColor Green
  Write-Host 'Confirm the hostname DNS points to the owned EDGE, then rerun with -Apply.'
  exit 0
}

Copy-Item -Force $staged $live

docker compose -f $compose config | Out-Null
if($LASTEXITCODE -ne 0){ throw 'Launch-stack Compose validation failed.' }

docker compose -f $compose up -d caddy
if($LASTEXITCODE -ne 0){ throw 'Could not start/update IZAKHONO EDGE.' }

docker compose -f $compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile
if($LASTEXITCODE -ne 0){ throw 'Caddy configuration validation failed.' }

docker compose -f $compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile
if($LASTEXITCODE -ne 0){ throw 'Caddy reload failed.' }

$result=[ordered]@{
  schema='izakhono.the-chancellor.public-verify.v1'
  generated_at=(Get-Date).ToUniversalTime().ToString('o')
  hostname=$Hostname
  dns=$false
  tcp443=$false
  https_health=$false
  readiness=$null
  fallback=$false
  overall='NOT_READY_KEEP_EXTERNAL'
}

try{
  $dns=Resolve-DnsName -Name $Hostname -ErrorAction Stop | Where-Object {$_.Type -in @('A','AAAA')}
  $result.dns=[bool]$dns
  $result.dns_answers=@($dns | ForEach-Object {$_.IPAddress})
}catch{$result.dns_error=$_.Exception.Message}

try{
  $tcp=Test-NetConnection -ComputerName $Hostname -Port 443 -WarningAction SilentlyContinue
  $result.tcp443=[bool]$tcp.TcpTestSucceeded
}catch{$result.tcp_error=$_.Exception.Message}

try{
  $r=Invoke-WebRequest -Uri ("https://"+$Hostname+"/api/health") -UseBasicParsing -TimeoutSec 15
  $result.https_health=($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
  $result.health_status=$r.StatusCode
}catch{$result.health_error=$_.Exception.Message}

try{
  $result.readiness=Invoke-RestMethod -Uri ("https://"+$Hostname+"/api/go-live") -TimeoutSec 15
}catch{$result.readiness_error=$_.Exception.Message}

try{
  $r=Invoke-WebRequest -Uri $fallback -UseBasicParsing -TimeoutSec 15
  $result.fallback=($r.StatusCode -ge 200 -and $r.StatusCode -lt 400)
  $result.fallback_status=$r.StatusCode
}catch{$result.fallback_error=$_.Exception.Message}

$ready=$false
if($result.readiness -and $result.readiness.PSObject.Properties.Name -contains 'readyForPaidTraffic'){
  $ready=[bool]$result.readiness.readyForPaidTraffic
}

if($result.dns -and $result.tcp443 -and $result.https_health -and $result.fallback -and $ready){
  $result.overall='OWNED_LIVE_VERIFIED'
}

$report=Join-Path ([Environment]::GetFolderPath('Desktop')) 'THE-CHANCELLOR-OWNED-PUBLIC-VERIFY.json'
$result | ConvertTo-Json -Depth 8 | Set-Content -Path $report -Encoding UTF8
$result | ConvertTo-Json -Depth 8
Write-Host "Report: $report"

if($result.overall -ne 'OWNED_LIVE_VERIFIED'){
  Write-Host '[HOLD] Keep Vercel fallback active. Owned public gates are not all passing.' -ForegroundColor Yellow
  exit 1
}

Write-Host '[PASS] THE CHANCELLOR is OWNED LIVE VERIFIED.' -ForegroundColor Green
Write-Host 'The external fallback remains available and was not removed.'
