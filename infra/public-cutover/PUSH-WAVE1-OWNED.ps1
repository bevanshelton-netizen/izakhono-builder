#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$AllegroHostname = 'allegro.izakhonoafrica.co.za',
  [string]$ChancellorHostname = 'chancellor.izakhonoafrica.co.za',
  [string]$PublicIPv4 = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$localLauncher=Join-Path $root 'RUN-NODE01-WAVE1-LOCAL.cmd'
$continueLauncher=Join-Path $root 'RUN-NODE01-WAVE1-CONTINUE.cmd'
$desktop=[Environment]::GetFolderPath('Desktop')
$nodeReport=Join-Path $desktop 'IZAKHONO-NODE01-WAVE1-REPORT.json'
$dnsReport=Join-Path $desktop 'IZAKHONO-WAVE1-DNS-ACTION.json'

function Assert-Hostname([string]$Value) {
  if ($Value -notmatch '^(?=.{4,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$') {
    throw "Invalid hostname: $Value"
  }
}

function Invoke-CmdGate([string]$Path,[string[]]$Arguments=@()) {
  if(-not (Test-Path $Path)){ throw "Missing launcher: $Path" }
  & $Path @Arguments
  $rc=$LASTEXITCODE
  if($rc -ne 0){ throw "Gate failed ($rc): $Path" }
}

function Test-IPv4([string]$Value) {
  $parsed=$null
  return [Net.IPAddress]::TryParse($Value,[ref]$parsed) -and
    $parsed.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork
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
  throw 'Could not discover the public IPv4 address. No DNS or EDGE changes were made.'
}

function Get-ARecords([string]$Host) {
  $answers=@()
  if(Get-Command Resolve-DnsName -ErrorAction SilentlyContinue){
    try {
      $answers=@(Resolve-DnsName -Name $Host -Type A -ErrorAction Stop |
        Where-Object {$_.IPAddress} |
        ForEach-Object {$_.IPAddress})
    } catch {}
  }
  if(-not $answers){
    try {
      $answers=@([Net.Dns]::GetHostAddresses($Host) |
        Where-Object {$_.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork} |
        ForEach-Object {$_.IPAddressToString})
    } catch {}
  }
  return @($answers | Sort-Object -Unique)
}

function Get-Nameservers([string]$Zone) {
  if(-not (Get-Command Resolve-DnsName -ErrorAction SilentlyContinue)){ return @() }
  try {
    return @(Resolve-DnsName -Name $Zone -Type NS -ErrorAction Stop |
      Where-Object {$_.NameHost} |
      ForEach-Object {$_.NameHost.TrimEnd('.')} |
      Sort-Object -Unique)
  } catch {
    return @()
  }
}

Assert-Hostname $AllegroHostname
Assert-Hostname $ChancellorHostname

Write-Host '============================================================'
Write-Host 'IZAKHONO WAVE 1 — PUSH TO OWNED'
Write-Host 'ALLEGRO VIBEZ + THE CHANCELLOR'
Write-Host 'Owned-first, externally reversible'
Write-Host '============================================================'

Write-Host '[1/4] Running fresh NODE01 local owned proof...'
Invoke-CmdGate $localLauncher

if(-not (Test-Path $nodeReport)){ throw "Expected NODE01 report was not created: $nodeReport" }
$local=Get-Content $nodeReport -Raw | ConvertFrom-Json
if($local.overall -ne 'PASS_LOCAL_OWNED'){
  throw 'NODE01 local proof did not pass. Existing external production remains authoritative.'
}

Write-Host '[2/4] Staging and dry-running owned EDGE routes...'
Invoke-CmdGate $continueLauncher @($AllegroHostname,$ChancellorHostname)

Write-Host '[3/4] Building DNS cutover evidence...'
$publicIp=Get-PublicIPv4
$allegroAnswers=Get-ARecords $AllegroHostname
$chancellorAnswers=Get-ARecords $ChancellorHostname
$nameservers=Get-Nameservers 'izakhonoafrica.co.za'

$allegroReady=$allegroAnswers -contains $publicIp
$chancellorReady=$chancellorAnswers -contains $publicIp
$dnsReady=$allegroReady -and $chancellorReady

$report=[ordered]@{
  schema='izakhono.wave1.dns-action.v1'
  generated_at=(Get-Date).ToUniversalTime().ToString('o')
  policy='owned-first-externally-reversible'
  public_ipv4=$publicIp
  zone='izakhonoafrica.co.za'
  nameservers=$nameservers
  records_needed=@(
    [ordered]@{type='A';name=$AllegroHostname;value=$publicIp;ttl=300},
    [ordered]@{type='A';name=$ChancellorHostname;value=$publicIp;ttl=300}
  )
  current_dns=@(
    [ordered]@{hostname=$AllegroHostname;answers=$allegroAnswers;matches_public_ipv4=$allegroReady},
    [ordered]@{hostname=$ChancellorHostname;answers=$chancellorAnswers;matches_public_ipv4=$chancellorReady}
  )
  dns_ready=$dnsReady
  external_fallbacks_preserved=$true
}

$report | ConvertTo-Json -Depth 8 | Set-Content -Path $dnsReport -Encoding UTF8
$report | ConvertTo-Json -Depth 8
Write-Host "DNS action report: $dnsReport"

if(-not $dnsReady){
  Write-Host ''
  Write-Host '[SAFE HOLD] NODE01 and EDGE dry-run passed, but public DNS is not pointed at this owner host yet.' -ForegroundColor Yellow
  Write-Host "Create/update the two A records shown in $dnsReport."
  Write-Host 'Then run this same launcher again. It will re-prove NODE01 before activating EDGE.'
  Write-Host 'Existing external production remains untouched.'
  exit 10
}

Write-Host '[4/4] DNS matches the owner host. Activating EDGE and running public acceptance...'
Invoke-CmdGate $continueLauncher @($AllegroHostname,$ChancellorHostname,'--apply-edge')

Write-Host ''
Write-Host '============================================================'
Write-Host '[PASS] Wave 1 owned public acceptance passed.' -ForegroundColor Green
Write-Host 'External fallbacks remain preserved.'
Write-Host 'Use the public verification report as the evidence for OWNED LIVE VERIFIED promotion.'
Write-Host '============================================================'
