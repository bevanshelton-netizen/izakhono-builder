#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$ECD360Url = 'https://edubuild-ecd360-staging.onrender.com',
  [string]$LegacyMartUrl = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Continue'

function Test-Route([string]$Name,[string]$Base,[string[]]$Paths,[string]$Role) {
  $item=[ordered]@{
    name=$Name
    url=$Base
    role=$Role
    assigned=([bool]$Base)
    reachable=$false
    paths=@()
    qualifies=$false
  }
  if(-not $Base){ return [pscustomobject]$item }
  if($Base -notmatch '^https://'){ $item.error='HTTPS required'; return [pscustomobject]$item }

  $all=$true
  foreach($p in $Paths){
    $r=[ordered]@{path=$p;ok=$false;status=$null}
    try{
      $resp=Invoke-WebRequest -Uri ($Base.TrimEnd('/')+$p) -UseBasicParsing -TimeoutSec 20
      $r.status=$resp.StatusCode
      $r.ok=($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400)
    }catch{
      $r.error=$_.Exception.Message
      $all=$false
    }
    if(-not $r.ok){$all=$false}
    $item.paths += [pscustomobject]$r
  }
  $item.reachable=$all
  $item.qualifies=$all
  return [pscustomobject]$item
}

$ecd=Test-Route 'edubuild-ecd360' $ECD360Url @('/','/health.json') 'staging-emergency-bridge-candidate'
$legacy=Test-Route 'legacymart' $LegacyMartUrl @('/','/health') 'production-fallback-required'

$overall='BLOCKED'
if($ecd.qualifies -and $legacy.qualifies){$overall='REACHABILITY_PASS_REQUIRES_OWNER_CLASSIFICATION'}

$report=[ordered]@{
  schema='izakhono.wave2.external-fallback.verify.v1'
  generated_at=(Get-Date).ToUniversalTime().ToString('o')
  wave=2
  overall=$overall
  note='Reachability does not upgrade a staging route into production. Owner classification and product readiness remain separate gates.'
  results=@($ecd,$legacy)
}
$path=Join-Path ([Environment]::GetFolderPath('Desktop')) 'IZAKHONO-WAVE2-EXTERNAL-FALLBACK-REPORT.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -Path $path -Encoding UTF8
$report | ConvertTo-Json -Depth 8
Write-Host "Report: $path"
if($overall -eq 'BLOCKED'){exit 1}
