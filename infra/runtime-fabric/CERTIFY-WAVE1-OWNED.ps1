#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$AllegroHostname = 'allegro.izakhonoafrica.co.za',
  [string]$ChancellorHostname = 'chancellor.izakhonoafrica.co.za',
  [string]$PublicIPv4 = '',
  [int]$MaxEvidenceAgeMinutes = 45,
  [switch]$SkipExecution,
  [string]$RegistryPath = '',
  [string]$NodeReport = '',
  [string]$DnsReport = '',
  [string]$PublicReport = '',
  [string]$CertificationPath = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$desktop = [Environment]::GetFolderPath('Desktop')
$pushScript = Join-Path $root 'infra\public-cutover\PUSH-WAVE1-OWNED.ps1'
if ([string]::IsNullOrWhiteSpace($RegistryPath)) { $RegistryPath = Join-Path $root 'infra\public-cutover\wave1-registry.json' }
if ([string]::IsNullOrWhiteSpace($NodeReport)) { $NodeReport = Join-Path $desktop 'IZAKHONO-NODE01-WAVE1-REPORT.json' }
if ([string]::IsNullOrWhiteSpace($DnsReport)) { $DnsReport = Join-Path $desktop 'IZAKHONO-WAVE1-DNS-ACTION.json' }
if ([string]::IsNullOrWhiteSpace($PublicReport)) { $PublicReport = Join-Path $desktop 'IZAKHONO-WAVE1-PUBLIC-VERIFY.json' }
if ([string]::IsNullOrWhiteSpace($CertificationPath)) { $CertificationPath = Join-Path $desktop 'IZAKHONO-WAVE1-OWNED-CERTIFICATION.json' }

function Assert-File([string]$Path, [string]$Label) {
  if (-not (Test-Path $Path)) { throw "Missing $Label evidence: $Path" }
}

function Read-Json([string]$Path) {
  return Get-Content -Raw -Path $Path | ConvertFrom-Json
}

function Assert-FreshIso([string]$Value, [string]$Label) {
  $stamp = [DateTimeOffset]::Parse($Value)
  $age = ([DateTimeOffset]::UtcNow - $stamp.ToUniversalTime()).TotalMinutes
  if ($age -lt -5 -or $age -gt $MaxEvidenceAgeMinutes) {
    throw "$Label evidence is stale or has an invalid clock offset ($([Math]::Round($age,1)) minutes old)."
  }
}

function Assert-FreshUnix([long]$Value, [string]$Label) {
  $stamp = [DateTimeOffset]::FromUnixTimeSeconds($Value)
  $age = ([DateTimeOffset]::UtcNow - $stamp).TotalMinutes
  if ($age -lt -5 -or $age -gt $MaxEvidenceAgeMinutes) {
    throw "$Label evidence is stale or has an invalid clock offset ($([Math]::Round($age,1)) minutes old)."
  }
}

function Sha256([string]$Path) {
  return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

function Get-App([object]$Collection, [string]$Slug) {
  return @($Collection | Where-Object { $_.slug -eq $Slug }) | Select-Object -First 1
}

function Assert-Certificate([object]$Certificate, [string]$Slug) {
  if (-not $Certificate) { throw "$Slug is missing TLS certificate evidence." }
  if ($Certificate.PSObject.Properties.Name -notcontains 'validated' -or -not [bool]$Certificate.validated) {
    throw "$Slug TLS certificate was not recorded as trust/hostname validated."
  }
  $expiry = [DateTimeOffset]::Parse([string]$Certificate.not_after)
  if ($expiry -le [DateTimeOffset]::UtcNow.AddHours(24)) {
    throw "$Slug TLS certificate expires too soon: $($Certificate.not_after)"
  }
}

if (-not $SkipExecution) {
  if (-not (Test-Path $pushScript)) { throw "Missing owned Wave 1 gate: $pushScript" }
  $args = @(
    '-NoProfile','-ExecutionPolicy','Bypass','-File',$pushScript,
    '-AllegroHostname',$AllegroHostname,
    '-ChancellorHostname',$ChancellorHostname
  )
  if (-not [string]::IsNullOrWhiteSpace($PublicIPv4)) {
    $args += @('-PublicIPv4',$PublicIPv4)
  }
  & powershell.exe @args
  $rc = $LASTEXITCODE
  if ($rc -eq 10) {
    throw 'Owned runtime local/EDGE preparation passed, but DNS is not yet pointed at the owned public IP. External production remains authoritative.'
  }
  if ($rc -ne 0) {
    throw "Owned Wave 1 execution gate failed with exit code $rc. External production remains authoritative."
  }
}

foreach ($pair in @(
  @($RegistryPath,'Wave 1 registry'),
  @($NodeReport,'NODE01 local'),
  @($DnsReport,'DNS owner-match'),
  @($PublicReport,'public DNS/TLS/HTTPS')
)) {
  Assert-File $pair[0] $pair[1]
}

$registry = Read-Json $RegistryPath
$node = Read-Json $NodeReport
$dns = Read-Json $DnsReport
$public = Read-Json $PublicReport

if ($node.schema -ne 'izakhono.node01.wave1.report.v1' -or $node.overall -ne 'PASS_LOCAL_OWNED') {
  throw 'NODE01 local owned evidence did not pass.'
}
if ([bool]$node.public_cutover_performed) {
  throw 'NODE01 local report unexpectedly claims a public cutover.'
}
if ([string]$node.builder_bundle_ref -eq 'UNATTESTED' -or [string]$node.wave1_bundle_sha256 -eq 'UNATTESTED') {
  throw 'NODE01 evidence is not attested to an installed Builder bundle.'
}
Assert-FreshUnix ([long]$node.finished_at) 'NODE01 local'

if ($dns.schema -ne 'izakhono.wave1.dns-action.v1' -or -not [bool]$dns.dns_ready) {
  throw 'DNS evidence does not prove both owned hostnames point to the owner public IP.'
}
if (-not [bool]$dns.external_fallbacks_preserved) {
  throw 'DNS evidence does not preserve external fallbacks.'
}
Assert-FreshIso ([string]$dns.generated_at) 'DNS'

if ($public.schema -ne 'izakhono.public-cutover.verify.v1' -or $public.overall -ne 'OWNED_PUBLIC_GATES_PASS') {
  throw 'Public DNS/TLS/HTTPS acceptance did not pass.'
}
if ([bool]$public.external_routes_changed) {
  throw 'Public verification indicates external resilience routes were changed.'
}
Assert-FreshIso ([string]$public.generated_at) 'Public acceptance'

$apps = @()
foreach ($slug in @('allegro-vibez','the-chancellor')) {
  $registered = Get-App $registry.apps $slug
  $local = Get-App $node.apps $slug
  $verified = Get-App $public.results $slug
  if (-not $registered -or -not $local -or -not $verified) {
    throw "Evidence is incomplete for $slug."
  }
  if ($local.result -ne 'local_owned_deployment_verified' -or -not [bool]$local.postcheck_local_health.ok) {
    throw "$slug local owned deployment did not pass."
  }
  if ([string]$local.immutable_ref -ne [string]$registered.immutable_ref) {
    throw "$slug immutable release identity does not match the Wave 1 registry."
  }
  if (-not ([bool]$verified.dns -and [bool]$verified.tcp443 -and [bool]$verified.https_health -and [bool]$verified.fallback)) {
    throw "$slug public acceptance/fallback evidence did not pass."
  }
  if ([string]$verified.hostname -ne [string]$registered.owned_hostname) {
    throw "$slug public hostname does not match the approved Wave 1 registry."
  }
  Assert-Certificate $verified.certificate $slug

  if ($slug -eq 'the-chancellor') {
    if (-not $verified.readiness -or
        $verified.readiness.PSObject.Properties.Name -notcontains 'readyForPaidTraffic' -or
        -not [bool]$verified.readiness.readyForPaidTraffic) {
      throw 'The Chancellor readiness gate is not approved for paid traffic.'
    }
  }

  $apps += [ordered]@{
    slug = $slug
    release_id = [string]$registered.immutable_ref
    runtime_class = 'owned'
    public_url = "https://$($verified.hostname)"
    health_http_status = [int]$verified.health_status
    dns_owner_match = $true
    tcp443 = $true
    tls_validated = $true
    certificate_not_after = [string]$verified.certificate.not_after
    certificate_sha256 = [string]$verified.certificate.sha256
    external_fallback_verified = $true
  }
}

$cert = [ordered]@{
  schema = 'izakhono.runtime-fabric.owned-wave1-certification.v1'
  certified_at = [DateTimeOffset]::UtcNow.ToString('o')
  status = 'OWNED_LIVE_VERIFIED'
  policy = 'owned-first-externally-reversible'
  runtime = [ordered]@{
    node = 'NODE01'
    class = 'owned'
    edge = 'IZAKHONO EDGE/TLS'
    source_authority = 'IZAKHONO CODE / approved immutable release'
  }
  evidence = [ordered]@{
    node01_local = [ordered]@{ file = (Split-Path $NodeReport -Leaf); sha256 = Sha256 $NodeReport }
    dns_owner_match = [ordered]@{ file = (Split-Path $DnsReport -Leaf); sha256 = Sha256 $DnsReport }
    public_acceptance = [ordered]@{ file = (Split-Path $PublicReport -Leaf); sha256 = Sha256 $PublicReport }
    builder_bundle_ref = [string]$node.builder_bundle_ref
    wave1_bundle_sha256 = [string]$node.wave1_bundle_sha256
    evidence_max_age_minutes = $MaxEvidenceAgeMinutes
  }
  resilience = [ordered]@{
    external_routes_preserved = $true
    failback_verified = $true
    active_active_stateful_writes_authorized = $false
  }
  apps = $apps
  public_live_claim = $true
  public_live_claim_scope = 'Wave 1 owned routes only; no claim for other IZAKHONO platforms or four-node FABRIC LIVE VERIFIED.'
}

$cert | ConvertTo-Json -Depth 10 | Set-Content -Path $CertificationPath -Encoding UTF8
$cert | ConvertTo-Json -Depth 10

Write-Host ''
Write-Host '[PASS] Wave 1 owned certification evidence is complete.' -ForegroundColor Green
Write-Host "Certification: $CertificationPath"
Write-Host 'Status: OWNED LIVE VERIFIED (Wave 1 only)'
Write-Host 'External resilience remains preserved.'
