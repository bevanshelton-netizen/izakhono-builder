#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidatePattern('^(?=.{4,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$')][string]$Hostname,
  [Parameter(Mandatory=$true)][ValidatePattern('^https://')][string]$FallbackUrl,
  [string]$Distro = 'Ubuntu-24.04',
  [switch]$ApplyEdge,
  [switch]$VerifyPublic
)

Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'

function Fail([string]$Message,[int]$Code=1){
  Write-Host "[STOP] $Message" -ForegroundColor Red
  exit $Code
}
function Pass([string]$Message){
  Write-Host "[PASS] $Message" -ForegroundColor Green
}
function Info([string]$Message){
  Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

$distros=@(wsl.exe -l -q 2>$null | ForEach-Object { ($_ -replace "`0",'').Trim() } | Where-Object { $_ })
if($distros -notcontains $Distro){
  if($Distro -eq 'Ubuntu-24.04' -and $distros -contains 'Ubuntu'){$Distro='Ubuntu'}
  else{Fail 'IZAKHONO owner WSL host is not installed.' 2}
}

$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$linuxRoot=(& wsl.exe -d $Distro -- wslpath -a "$repoRoot").Trim()
if(-not $linuxRoot){Fail 'Could not map the IZAKHONO repository into WSL.' 3}

$desktop=[Environment]::GetFolderPath('Desktop')
$reportPath=Join-Path $desktop 'IZAKHONO-SIGN-FINAL-ACTIVATION.json'
$logPath=Join-Path $desktop 'IZAKHONO-SIGN-FINAL-ACTIVATION.log'
$report=[ordered]@{
  schema='izakhono.sign.final_activation.v1'
  generated_at=(Get-Date).ToUniversalTime().ToString('o')
  hostname=$Hostname
  fallback_url=$FallbackUrl
  internal_chain=$false
  mail_ready=$false
  smtp_configured=$false
  sign_ready=$false
  sign_public_base=$false
  edge_staged=$false
  edge_dry_run=$false
  edge_applied=$false
  public_verified=$false
  overall='INCOMPLETE'
  next_action=''
}

Start-Transcript -Path $logPath -Force | Out-Null
try{
  Info 'Deploying/verifying DOCFLOW + FLOWIQ + CRM + SIGN + MAIL on NODE01...'
  & wsl.exe -d $Distro -u root -- bash "$linuxRoot/products/izakhono-mail/owner-node/deploy-mail-sign.sh" "$linuxRoot"
  if($LASTEXITCODE -ne 0){Fail 'Internal workflow-chain deployment failed.' 10}
  $report.internal_chain=$true
  Pass 'Internal document workflow chain verified.'

  $mail=Invoke-RestMethod -Uri 'http://127.0.0.1:9899/readyz' -TimeoutSec 10
  if(-not $mail.ok){Fail 'IZAKHONO MAIL is not ready.' 11}
  $report.mail_ready=$true
  $report.smtp_configured=[bool]$mail.smtp_configured
  if(-not $mail.smtp_configured){
    $report.next_action='Configure MAIL_SMTP_HOST, MAIL_SMTP_PORT, MAIL_FROM_EMAIL and required SMTP credentials in /etc/izakhono/apps/izakhono-mail.env, then rerun.'
    $report.overall='BLOCKED_SMTP_CONFIGURATION_REQUIRED'
    $report | ConvertTo-Json -Depth 8 | Set-Content $reportPath -Encoding UTF8
    Fail 'SMTP is not configured. Public signing invitations cannot be sent yet.' 12
  }
  Pass 'Outbound SMTP route is configured.'

  Info "Configuring SIGN public base https://$Hostname ..."
  & wsl.exe -d $Distro -u root -- bash "$linuxRoot/products/izakhono-sign/owner-node/set-public-base.sh" "$linuxRoot" "$Hostname"
  if($LASTEXITCODE -ne 0){Fail 'SIGN public-base configuration failed.' 13}

  $sign=Invoke-RestMethod -Uri 'http://127.0.0.1:9898/readyz' -TimeoutSec 10
  if(-not $sign.ok){Fail 'IZAKHONO SIGN is not ready.' 14}
  $report.sign_ready=$true
  $report.sign_public_base=[bool]$sign.public_route_configured
  if(-not $sign.public_route_configured){Fail 'SIGN public base is not configured after redeployment.' 15}
  Pass 'SIGN public base configured.'

  Info 'Staging owned EDGE route...'
  & (Join-Path $repoRoot 'products\izakhono-sign\public-cutover\STAGE-SIGN-EDGE.ps1') -Hostname $Hostname
  $report.edge_staged=$true

  Info 'Running EDGE activation dry run...'
  & (Join-Path $repoRoot 'products\izakhono-sign\public-cutover\ACTIVATE-SIGN-EDGE.ps1')
  $report.edge_dry_run=$true
  Pass 'EDGE dry run passed.'

  if($ApplyEdge){
    Info 'Applying SIGN route to owner-controlled Caddy EDGE...'
    & (Join-Path $repoRoot 'products\izakhono-sign\public-cutover\ACTIVATE-SIGN-EDGE.ps1') -Apply
    $report.edge_applied=$true
    Pass 'SIGN route loaded into local EDGE.'
  } else {
    $report.next_action='Re-run with -ApplyEdge after confirming the hostname/DNS target. Then point DNS at the owned EDGE and verify publicly.'
    $report.overall='READY_FOR_EDGE_APPLY'
  }

  if($VerifyPublic){
    Info 'Verifying public DNS/TLS/HTTPS/fallback gates...'
    & (Join-Path $repoRoot 'products\izakhono-sign\public-cutover\VERIFY-SIGN-PUBLIC.ps1') -Hostname $Hostname -FallbackUrl $FallbackUrl
    if($LASTEXITCODE -ne 0){
      $report.next_action='Keep the external fallback active. Fix DNS/TLS/443/EDGE or fallback verification failures and rerun public verification.'
      $report.overall='PUBLIC_VERIFY_FAILED_KEEP_FALLBACK'
      $report | ConvertTo-Json -Depth 8 | Set-Content $reportPath -Encoding UTF8
      Fail 'Public verification did not pass every gate.' 20
    }
    $report.public_verified=$true
    $report.overall='PUBLIC_OPERATIONAL_GATES_PASS'
    $report.next_action='Maintain the independent fallback and monitor SIGN/MAIL delivery evidence.'
    Pass 'Public SIGN route passed DNS, TLS, HTTPS, landing-page and fallback verification.'
  }

  $report | ConvertTo-Json -Depth 8 | Set-Content $reportPath -Encoding UTF8
  Write-Host ''
  Write-Host "Activation report: $reportPath"
  Write-Host "Execution log: $logPath"
}
finally{
  try{Stop-Transcript | Out-Null}catch{}
}
