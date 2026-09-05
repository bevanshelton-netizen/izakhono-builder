#requires -Version 5.1
[CmdletBinding()]
param([string]$Model = "")

$ErrorActionPreference = "Stop"

function Fail([string]$Message, [int]$Code = 1) {
  Write-Error $Message
  exit $Code
}

function Find-Ollama {
  $cmd = Get-Command ollama.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"),
    (Join-Path $env:ProgramFiles "Ollama\ollama.exe")
  )
  foreach ($p in $candidates) { if (Test-Path $p) { return $p } }
  return $null
}

function Find-Python {
  $cmd = Get-Command python.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command py.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $roots = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Python"),
    (Join-Path $env:ProgramFiles "Python")
  )
  foreach ($root in $roots) {
    if (Test-Path $root) {
      $hit = Get-ChildItem $root -Recurse -Filter python.exe -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
      if ($hit) { return $hit.FullName }
    }
  }
  return $null
}

function Ensure-Winget {
  $cmd = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $cmd) {
    Fail "Windows Package Manager (winget) is required for the one-run native installer. Install Microsoft App Installer, then run this script again." 20
  }
  return $cmd.Source
}

function Http-Healthy([string]$Url) {
  try {
    Invoke-RestMethod -Uri $Url -TimeoutSec 3 | Out-Null
    return $true
  } catch {
    return $false
  }
}

$ProductDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppSource = Join-Path $ProductDir "app.py"
if (-not (Test-Path $AppSource)) { Fail "IZAKHONO WORK app.py is missing." 21 }

$winget = Ensure-Winget

$ollama = Find-Ollama
if (-not $ollama) {
  Write-Host "Installing the local model runtime..."
  $args = @("install","--id","Ollama.Ollama","--exact","--accept-package-agreements","--accept-source-agreements","--silent")
  & $winget @args
  if ($LASTEXITCODE -ne 0) { Fail "Ollama installation failed." 22 }
  Start-Sleep -Seconds 2
  $ollama = Find-Ollama
  if (-not $ollama) { Fail "Ollama installed but could not be located." 23 }
}

$python = Find-Python
if (-not $python) {
  Write-Host "Installing the local Python runtime..."
  $args = @("install","--id","Python.Python.3.13","--exact","--accept-package-agreements","--accept-source-agreements","--silent")
  & $winget @args
  if ($LASTEXITCODE -ne 0) { Fail "Python installation failed." 24 }
  Start-Sleep -Seconds 2
  $python = Find-Python
  if (-not $python) { Fail "Python installed but could not be located." 25 }
}

if (-not $Model) {
  try {
    $ram = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
    if ($ram -ge 24GB) { $Model = "qwen3:8b" } else { $Model = "qwen3:4b" }
  } catch {
    $Model = "qwen3:4b"
  }
}

$Root = Join-Path $env:LOCALAPPDATA "IzakhonoWork"
$Data = Join-Path $Root "data"
$App = Join-Path $Root "app.py"
$Launcher = Join-Path $Root "start-izakhono-work.ps1"
New-Item -ItemType Directory -Force -Path $Root, $Data | Out-Null
Copy-Item -Force $AppSource $App

if (-not (Http-Healthy "http://127.0.0.1:11434/api/tags")) {
  Start-Process -FilePath $ollama -ArgumentList @("serve") -WindowStyle Hidden
  $ok = $false
  for ($i=0; $i -lt 60; $i++) {
    if (Http-Healthy "http://127.0.0.1:11434/api/tags") { $ok = $true; break }
    Start-Sleep -Seconds 2
  }
  if (-not $ok) { Fail "The local model runtime did not become healthy." 30 }
}

Write-Host "Preparing owner model: $Model"
& $ollama pull $Model
if ($LASTEXITCODE -ne 0) { Fail "The owner model could not be downloaded." 31 }

$launcherBody = @'
$ErrorActionPreference = "SilentlyContinue"
$ollama = "__OLLAMA__"
$python = "__PYTHON__"
$app = "__APP__"
$data = "__DATA__"
if (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port 11434 -InformationLevel Quiet)) {
  Start-Process -FilePath $ollama -ArgumentList @("serve") -WindowStyle Hidden
  Start-Sleep -Seconds 2
}
$env:IZAKHONO_WORK_HOST = "127.0.0.1"
$env:IZAKHONO_WORK_PORT = "9393"
$env:IZAKHONO_WORK_TOKEN = ""
$env:IZAKHONO_WORK_DATA = $data
$env:IZAKHONO_OLLAMA_URL = "http://127.0.0.1:11434"
$env:IZAKHONO_WORK_MODEL = "__MODEL__"
if (-not (Test-NetConnection -ComputerName 127.0.0.1 -Port 9393 -InformationLevel Quiet)) {
  Start-Process -FilePath $python -ArgumentList @($app) -WindowStyle Hidden
}
'@
$launcherBody = $launcherBody.Replace("__OLLAMA__", $ollama.Replace("'","''"))
$launcherBody = $launcherBody.Replace("__PYTHON__", $python.Replace("'","''"))
$launcherBody = $launcherBody.Replace("__APP__", $App.Replace("'","''"))
$launcherBody = $launcherBody.Replace("__DATA__", $Data.Replace("'","''"))
$launcherBody = $launcherBody.Replace("__MODEL__", $Model.Replace("'","''"))
Set-Content -Path $Launcher -Value $launcherBody -Encoding UTF8

$startup = [Environment]::GetFolderPath("Startup")
$startupCmd = Join-Path $startup "IZAKHONO WORK.cmd"
$cmdBody = @"
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$Launcher"
"@
Set-Content -Path $startupCmd -Value $cmdBody -Encoding ASCII

Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-WindowStyle","Hidden","-File",$Launcher) -WindowStyle Hidden

$ready = $false
for ($i=0; $i -lt 60; $i++) {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:9393/healthz" -TimeoutSec 3
    if ($health.ok) { $ready = $true; break }
  } catch {
    Start-Sleep -Seconds 2
  }
}
if (-not $ready) { Fail "IZAKHONO WORK did not pass its local health gate." 32 }

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcut = Join-Path $desktop "IZAKHONO WORK.url"
@"
[InternetShortcut]
URL=http://127.0.0.1:9393
"@ | Set-Content -Path $shortcut -Encoding ASCII

Write-Host ""
Write-Host "IZAKHONO_WORK_NATIVE_WINDOWS=READY"
Write-Host "Workspace: http://127.0.0.1:9393"
Write-Host "Owner model: $Model"
Write-Host "Desktop shortcut: $shortcut"
Write-Host "Docker is not used by this native Windows path."
Write-Host "No per-message usage-credit gate is implemented."
Write-Host "The service remains bound to localhost only."
