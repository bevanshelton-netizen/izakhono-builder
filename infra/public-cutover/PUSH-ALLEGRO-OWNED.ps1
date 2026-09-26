#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$AllegroHostname = 'allegro.izakhonoafrica.co.za',
  [string]$PublicIPv4 = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$localLauncher=Join-Path $root 'RUN-NODE01-ALLEGRO-LOCAL.cmd'
$stage=Join-Path $PSScriptRoot 'STAGE-ALLEGRO-EDGE.ps1'
$activate=Join-Path $PSScriptRoot 'ACTIVATE-ALLEGRO-EDGE.ps1'
$verify=Join-Path $PSScriptRoot 'VERIFY-ALLEGRO-PUBLIC.ps1'
$desktop=[Environment]::GetFolderPath('Desktop')
$nodeReport=Join-Path $desktop 'IZAKHONO-NODE01-ALLEGRO-REPORT.json'
$dnsReport=Join-Path $desktop 'IZAKHONO-ALLEGRO-DNS-ACTION.json'

function Test-IPv4([string]$Value) {
  $parsed=$null
  return [Net.IPAddress]::TryParse($Value,[ref]$parsed) -and $parsed.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork
}
function Get-PublicIPv4 {
  if($PublicIPv4){
    $candidate=$PublicIPv4.Trim()
    if(-not (Test-IPv4 $candidate)){ throw "Invalid -PublicIPv4 value: $candidate" }
    return $candidate
  }
  foreach($uri in @('https://api.ipify.org','https://ipv4.icanhazip.com')){
    try {
      $candidate=([string](Invoke-RestMethod -Uri $uri -TimeoutSec 10)).Trim()
      if(Test-IPv4 $candidate){ return $candidate }
    } catch {}
  }
  throw 'Could not discover the owner-host public IPv4 address.'
}
function Get-ARecords([string]$Host) {
  try {
    return @(Resolve-DnsName -Name $Host -Type A -ErrorAction Stop |
      Where-Object {$_.IPAddress} | ForEach-Object {$_.IPAddress} | Sort-Object -Unique)
  } catch { return @() }
}
function Get-Nameservers {
  try {
    return @(Resolve-DnsName -Name 'izakhonoafrica.co.za' -Type NS -ErrorAction Stop |
      Where-Object {$_.NameHost} | ForEach-Object {$_.NameHost.TrimEnd('.')} | Sort-Object -Unique)
  } catch { return @() }
}

Write-Host '============================================================'
Write-Host 'IZAKHONO - ALLEGRO VIBEZ PUSH TO OWNED'
Write-Host 'Independent of all other platforms'
Write-Host '============================================================'

Write-Host '[1/5] Proving ALLEGRO locally on NODE01...'
& $localLauncher
if($LASTEXITCODE -ne 0){ throw 'ALLEGRO local owned proof failed.' }

if(-not (Test-Path $nodeReport)){ throw "Missing ALLEGRO proof: $nodeReport" }
$local=Get-Content $nodeReport -Raw | ConvertFrom-Json
if($local.overall -ne 'PASS_LOCAL_OWNED'){ throw 'ALLEGRO local proof is not PASS_LOCAL_OWNED.' }
$app=@($local.apps | Where-Object {$_.slug -eq 'allegro-vibez'})
if($app.Count -ne 1 -or $app[0].result -ne 'local_owned_deployment_verified'){ throw 'ALLEGRO deployment was not locally verified.' }

Write-Host '[2/5] Staging and dry-running ALLEGRO EDGE...'
& $stage -AllegroHostname $AllegroHostname
if($LASTEXITCODE -ne 0){ throw 'ALLEGRO EDGE staging failed.' }
& $activate
if($LASTEXITCODE -ne 0){ throw 'ALLEGRO EDGE dry-run failed.' }

Write-Host '[3/5] Building ALLEGRO DNS action evidence...'
$publicIp=Get-PublicIPv4
$answers=Get-ARecords $AllegroHostname
$nameservers=Get-Nameservers
$dnsReady=$answers -contains $publicIp

$report=[ordered]@{
  schema='izakhono.allegro.dns-action.v1'
  generated_at=(Get-Date).ToUniversalTime().ToString('o')
  policy='owned-first-externally-reversible'
  public_ipv4=$publicIp
  zone='izakhonoafrica.co.za'
  nameservers=$nameservers
  record_needed=[ordered]@{type='A';name=$AllegroHostname;value=$publicIp;ttl=300}
  current_answers=$answers
  dns_ready=$dnsReady
  external_fallback_preserved=$true
}
$report | ConvertTo-Json -Depth 8 | Set-Content -Path $dnsReport -Encoding UTF8
$report | ConvertTo-Json -Depth 8
Write-Host "DNS action report: $dnsReport"

if(-not $dnsReady){
  Write-Host '[SAFE HOLD] ALLEGRO is locally proven and EDGE-staged, but public DNS does not point here yet.' -ForegroundColor Yellow
  Write-Host "Create/update the A record shown in $dnsReport, then rerun this launcher."
  exit 10
}

Write-Host '[4/5] DNS matches owner host. Activating ALLEGRO EDGE...'
& $activate -Apply
if($LASTEXITCODE -ne 0){ throw 'ALLEGRO EDGE activation failed.' }

Write-Host '[5/5] Verifying public DNS/TLS/HTTPS/identity...'
& $verify -AllegroHostname $AllegroHostname
if($LASTEXITCODE -ne 0){ throw 'ALLEGRO public acceptance failed; keep external fallback authoritative.' }

Write-Host '[PASS] ALLEGRO OWNED PUBLIC ACCEPTANCE PASSED.' -ForegroundColor Green
Write-Host 'External fallback remains preserved.'
