#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$RuntimeTargetId,
  [Parameter(Mandatory=$true)][string]$ReleaseId,
  [Parameter(Mandatory=$true)][string]$RuntimeHealthUrl,
  [Parameter(Mandatory=$true)][string]$PublicHealthUrl,
  [string]$RuntimeClass = 'owned',
  [string]$PublicHostname = '',
  [string]$EvidenceDirectory = '',
  [switch]$VerifyOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($EvidenceDirectory)) {
  $EvidenceDirectory = Join-Path ([Environment]::GetFolderPath('Desktop')) 'IZAKHONO-RUNTIME-EVIDENCE'
}
New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null

function Get-NowIso { (Get-Date).ToUniversalTime().ToString('o') }
function Write-Json([string]$Path,[object]$Value) {
  $Value | ConvertTo-Json -Depth 12 | Set-Content -Path $Path -Encoding UTF8
}
function Get-Sha256([string]$Path) { (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant() }

function Invoke-Health([string]$Url,[string]$Label) {
  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
    return [ordered]@{ label=$Label; url=$Url; ok=($response.StatusCode -ge 200 -and $response.StatusCode -lt 300); status=[int]$response.StatusCode; checked_at=(Get-NowIso) }
  } catch {
    return [ordered]@{ label=$Label; url=$Url; ok=$false; status=0; error=$_.Exception.Message; checked_at=(Get-NowIso) }
  }
}

if ($RuntimeClass -notin @('owned','external-resilience')) { throw 'RuntimeClass must be owned or external-resilience.' }
if ([string]::IsNullOrWhiteSpace($RuntimeTargetId)) { throw 'RuntimeTargetId is required.' }
if ([string]::IsNullOrWhiteSpace($ReleaseId)) { throw 'ReleaseId is required.' }

$runtime = Invoke-Health $RuntimeHealthUrl 'runtime'
$public = Invoke-Health $PublicHealthUrl 'public'

$dnsVerified = $false
if (-not [string]::IsNullOrWhiteSpace($PublicHostname)) {
  try {
    $dns = Resolve-DnsName -Name $PublicHostname -ErrorAction Stop |
      Where-Object { $_.IPAddress } |
      ForEach-Object { $_.IPAddress } | Sort-Object -Unique
    $dnsVerified = @($dns).Count -gt 0
  } catch { $dns = @() }
} else { $dns = @() }

$evidence = [ordered]@{
  schema='izakhono.runtime-fabric.logical-runtime-evidence.v1'
  generated_at=(Get-NowIso)
  runtime_target=[ordered]@{ id=$RuntimeTargetId; class=$RuntimeClass }
  release=[ordered]@{ immutable_ref=$ReleaseId }
  runtime_health=$runtime
  deployment_verified=([bool]$runtime.ok)
  edge_verified=([bool]$public.ok)
  tls_verified=([bool]$public.ok -and $PublicHealthUrl -match '^https://')
  dns_verified=$dnsVerified
  dns_answers=@($dns)
  public_smoke_test=([bool]$public.ok)
  rollback_ready=$false
  physical_node_required=$false
  verification_mode=if($VerifyOnly){'verify-only'}else{'runtime-evidence'}
}

$evidencePath = Join-Path $EvidenceDirectory 'runtime-evidence.json'
Write-Json $evidencePath $evidence

$allRequired = $evidence.runtime_health.ok -and
  $evidence.deployment_verified -and
  $evidence.edge_verified -and
  $evidence.tls_verified -and
  $evidence.dns_verified -and
  $evidence.public_smoke_test -and
  $evidence.rollback_ready

$decision = [ordered]@{
  schema='izakhono.runtime-fabric.activation-decision.v2'
  decided_at=(Get-NowIso)
  runtime_target_id=$RuntimeTargetId
  runtime_class=$RuntimeClass
  release_id=$ReleaseId
  status=if($allRequired){'LIVE_VERIFIED'}else{'BLOCKED'}
  may_route_public_traffic=[bool]$allRequired
  missing=@(
    if(-not $evidence.runtime_health.ok){'runtime'}
    if(-not $evidence.deployment_verified){'deployment'}
    if(-not $evidence.edge_verified){'edge'}
    if(-not $evidence.tls_verified){'tls'}
    if(-not $evidence.dns_verified){'dns'}
    if(-not $evidence.public_smoke_test){'smoke'}
    if(-not $evidence.rollback_ready){'rollback'}
  )
  physical_node_required=$false
  evidence_file=$evidencePath
}

$decisionPath = Join-Path $EvidenceDirectory 'activation-decision.json'
Write-Json $decisionPath $decision

if($allRequired){
  Write-Host '[PASS] Logical runtime target passed all activation gates.' -ForegroundColor Green
  Write-Host "Target: $RuntimeTargetId"
  Write-Host "Release: $ReleaseId"
  Write-Host 'Status: LIVE_VERIFIED'
} else {
  Write-Host '[BLOCKED] Runtime evidence is incomplete. Public routing is not authorized.' -ForegroundColor Yellow
  Write-Host ("Missing: " + ($decision.missing -join ', '))
  Write-Host 'No physical NODE is required by this certification contract.'
  exit 10
}
