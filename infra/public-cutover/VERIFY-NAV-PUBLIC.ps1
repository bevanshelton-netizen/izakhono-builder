#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Hostname = 'nav.izakhonoafrica.co.za'
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$base="https://$Hostname"
$report=Join-Path $PSScriptRoot 'NAV-PUBLIC-VERIFICATION.txt'
$rows=New-Object System.Collections.Generic.List[string]

function Pass([string]$Name){ $rows.Add("$Name=PASS"); Write-Host "[PASS] $Name" -ForegroundColor Green }
function Fail([string]$Name,[string]$Detail){ $rows.Add("$Name=FAIL $Detail"); throw "[FAIL] $Name — $Detail" }

try {
  $page=Invoke-WebRequest -Uri "$base/" -UseBasicParsing -TimeoutSec 15
  if($page.StatusCode -ne 200 -or $page.Content -notmatch 'IZAKHONO NAV'){ Fail 'HTTPS_NAV_EXPERIENCE' 'Unexpected response' }
  Pass 'HTTPS_NAV_EXPERIENCE'

  $h=Invoke-RestMethod -Uri "$base/api/health" -TimeoutSec 15
  if($h.runtimeClass -ne 'owned' -or $h.routing -ne 'ready' -or $h.search -ne 'ready' -or $h.tiles -ne 'ready' -or $h.node01Required -ne $false){
    Fail 'OWNED_RUNTIME_IDENTITY' 'Owned NAV health contract failed'
  }
  Pass 'OWNED_RUNTIME_IDENTITY'

  $s=Invoke-RestMethod -Uri "$base/api/search?q=Johannesburg" -TimeoutSec 15
  if(-not $s -or $s.Count -lt 1){ Fail 'SEARCH' 'No Johannesburg result' }
  Pass 'SEARCH'

  $r=Invoke-RestMethod -Uri "$base/api/route/driving/28.0473,-26.2041;28.0478,-26.1950" -TimeoutSec 20
  if(-not $r.geometry.coordinates -or [double]$r.distance -le 0 -or [double]$r.duration -le 0){ Fail 'ROUTE' 'Invalid route response' }
  Pass 'ROUTE'

  $tile=Invoke-WebRequest -Uri "$base/tiles/10/591/589.png" -UseBasicParsing -TimeoutSec 20
  if($tile.StatusCode -ne 200 -or $tile.RawContentLength -lt 1){ Fail 'OWNED_TILE' 'Tile unavailable' }
  Pass 'OWNED_TILE'

  $rows.Add("STATUS=OWNED LIVE VERIFIED")
  $rows.Add("URL=$base/")
  $rows.Add("VERIFIED_UTC=$([DateTime]::UtcNow.ToString('o'))")
  Set-Content -Path $report -Value $rows -Encoding UTF8
  Write-Host ''
  Write-Host "OWNED LIVE VERIFIED: $base/" -ForegroundColor Green
  Write-Host "Evidence: $report"
} catch {
  $rows.Add("STATUS=NOT PUBLICLY VERIFIED")
  $rows.Add("ERROR=$($_.Exception.Message)")
  $rows.Add("CHECKED_UTC=$([DateTime]::UtcNow.ToString('o'))")
  Set-Content -Path $report -Value $rows -Encoding UTF8
  throw
}
