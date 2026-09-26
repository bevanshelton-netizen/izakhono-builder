#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$AllegroHostname = 'allegro.izakhonoafrica.co.za',
  [string]$ReleaseId = '',
  [string[]]$OwnedTargets = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

if ($AllegroHostname -notmatch '^(?=.{4,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$') {
  throw "Invalid hostname: $AllegroHostname"
}

$root=(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$configPath=Join-Path $root 'infra\runtime-fabric\allegro-vibez.json'
$config=Get-Content $configPath -Raw | ConvertFrom-Json
if(-not $ReleaseId){ $ReleaseId=[string]$config.release_id }
if($ReleaseId -notmatch '^[0-9a-f]{40}$'){ throw 'Runtime Fabric release_id must be an immutable 40-character SHA.' }

function Test-BaseUrl([string]$Value){
  $uri=$null
  if(-not [Uri]::TryCreate($Value,[UriKind]::Absolute,[ref]$uri)){ return $false }
  if($uri.Scheme -notin @('http','https')){ return $false }
  if($uri.UserInfo -or $uri.Query -or $uri.Fragment){ return $false }
  return $uri.AbsolutePath -eq '/'
}

$targets=@()
if($OwnedTargets.Count -gt 0){
  $i=0
  foreach($url in $OwnedTargets){
    $i++
    $targets += [pscustomobject]@{name="OWNED-$i";url=$url.TrimEnd('/');preference=$i}
  }
}else{
  foreach($declared in $config.owned_targets){
    $envName=[string]$declared.environment_variable
    $url=[Environment]::GetEnvironmentVariable($envName)
    if($url){
      $targets += [pscustomobject]@{name=[string]$declared.name;url=$url.TrimEnd('/');preference=[int]$declared.preference}
    }
  }
}
if($targets.Count -eq 0){ throw 'No Allegro owned Runtime Fabric target URLs are configured.' }

$checks=@()
$healthy=@()
foreach($target in ($targets | Sort-Object preference)){
  if(-not (Test-BaseUrl ($target.url+'/'))){ throw "Unsafe owned target URL for $($target.name): $($target.url)" }
  $healthUrl=$target.url + [string]$config.health_path
  $item=[ordered]@{name=$target.name;url=$target.url;health_url=$healthUrl;preference=$target.preference;healthy=$false;release_match=$false}
  try{
    $health=Invoke-RestMethod -Uri $healthUrl -TimeoutSec 8
    $item.healthy=([bool]$health.ok -and [string]$health.product -eq 'allegro-vibez' -and [string]$health.runtime_class -eq 'owned')
    $item.release_match=([string]$health.release_id -eq $ReleaseId)
    $item.reported_release=[string]$health.release_id
    if($item.healthy -and $item.release_match){
      $healthy += $target
    }
  }catch{
    $item.error=$_.Exception.Message
  }
  $checks += [pscustomobject]$item
}

if($healthy.Count -lt 1){
  $checks | ConvertTo-Json -Depth 6
  throw "No owned Allegro target is healthy on approved release $ReleaseId."
}

$upstreams=($healthy | Sort-Object preference | ForEach-Object {$_.url}) -join ' '
$body=@"
$AllegroHostname {
  encode zstd gzip
  reverse_proxy $upstreams {
    lb_policy first
    health_uri /healthz
    health_interval 10s
    health_timeout 3s
    fail_duration 30s
    max_fails 2
  }
}
"@

$generated=Join-Path $PSScriptRoot 'generated'
New-Item -ItemType Directory -Force -Path $generated | Out-Null
$caddyPath=Join-Path $generated '20-allegro-vibez.caddy'
Set-Content -Path $caddyPath -Value $body -Encoding UTF8

$evidence=[ordered]@{
  schema='izakhono.allegro.runtime-fabric.stage.v1'
  generated_at=(Get-Date).ToUniversalTime().ToString('o')
  product='allegro-vibez'
  release_id=$ReleaseId
  hostname=$AllegroHostname
  single_node_launch_gate=$false
  configured_targets=$checks
  selected_targets=@($healthy | Sort-Object preference)
  selected_count=$healthy.Count
  public_cutover_performed=$false
}
$evidencePath=Join-Path $generated 'ALLEGRO-RUNTIME-FABRIC-STAGE.json'
$evidence | ConvertTo-Json -Depth 8 | Set-Content -Path $evidencePath -Encoding UTF8

Write-Host "[PASS] ALLEGRO Runtime Fabric staged with $($healthy.Count) verified owned target(s)." -ForegroundColor Green
Write-Host "Release: $ReleaseId"
Write-Host "Caddy: $caddyPath"
Write-Host "Evidence: $evidencePath"
Write-Host 'No live EDGE route or DNS record was changed.'
