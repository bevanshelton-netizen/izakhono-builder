$ErrorActionPreference = "Stop"

$SecretDir = Join-Path $env:LOCALAPPDATA "Izakhono\Secrets"
$SecretFile = Join-Path $SecretDir "external-ai.key.dpapi"

New-Item -ItemType Directory -Force -Path $SecretDir | Out-Null

Write-Host "IZAKHONO SUPER AI - secure external API credential setup" -ForegroundColor Cyan
Write-Host "The credential will be encrypted with Windows DPAPI for this Windows user."
Write-Host "It will not be written to the IZAKHONO repository or printed to the console."
Write-Host ""

$secret = Read-Host "Enter the external AI API key" -AsSecureString
if (-not $secret) {
  throw "No credential supplied."
}

$encrypted = ConvertFrom-SecureString $secret
Set-Content -Path $SecretFile -Value $encrypted -Encoding UTF8
$acl = Get-Acl $SecretFile
$acl.SetAccessRuleProtection($true, $false)
$currentIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
  $currentIdentity,
  "FullControl",
  "Allow"
)
$acl.SetAccessRule($rule)
Set-Acl -Path $SecretFile -AclObject $acl

Write-Host ""
Write-Host "External AI credential stored in the local Windows user secret store." -ForegroundColor Green
Write-Host "Path: $SecretFile"
Write-Host "The SUPER AI launcher can now decrypt it only for this Windows user."
