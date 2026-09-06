#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Model = "qwen3:4b",
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $Root "python.exe"
$App = Join-Path $Root "app.py"
$ExpectedVersion = "1.0.0"
$HealthUrl = "http://127.0.0.1:9393/healthz"
$OllamaUrl = "http://127.0.0.1:11434"
$Data = Join-Path $env:LOCALAPPDATA "IzakhonoWork\data"

function Get-Json([string]$Url, [int]$Timeout = 3) {
  try { return Invoke-RestMethod -Uri $Url -TimeoutSec $Timeout } catch { return $null }
}

function Stop-StaleIzakhonoWork {
  $health = Get-Json $HealthUrl
  if (-not $health) { return }
  if ($health.service -ne "izakhono-work") {
    throw "Port 9393 is already used by another local service. IZAKHONO WORK will not stop it."
  }
  if ($health.version -eq $ExpectedVersion -and $health.build_transport -eq "background_jobs") {
    return
  }
  Write-Host "Replacing older IZAKHONO WORK service..."
  $connection = Get-NetTCPConnection -LocalPort 9393 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($connection) { Stop-Process -Id $connection.OwningProcess -Force -ErrorAction Stop }
  for ($i=0; $i -lt 30; $i++) {
    if (-not (Get-Json $HealthUrl)) { return }
    Start-Sleep -Milliseconds 500
  }
  throw "Could not stop the older IZAKHONO WORK service."
}

function Find-Ollama {
  $cmd = Get-Command ollama.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"),
    (Join-Path $env:LOCALAPPDATA "Ollama\ollama.exe"),
    (Join-Path $env:ProgramFiles "Ollama\ollama.exe")
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) { return $candidate }
  }
  return $null
}

function Ensure-Ollama {
  if (Get-Json "$OllamaUrl/api/tags") { return (Find-Ollama) }
  $ollama = Find-Ollama
  if (-not $ollama) {
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if (-not $winget) {
      throw "Ollama is not installed and Windows Package Manager is unavailable."
    }
    Write-Host "Installing local AI runtime..."
    & $winget.Source install --id Ollama.Ollama --exact --accept-package-agreements --accept-source-agreements --silent
    if ($LASTEXITCODE -ne 0) { throw "Ollama installation failed." }
    Start-Sleep -Seconds 3
    $ollama = Find-Ollama
    if (-not $ollama) { throw "Ollama installed but could not be located." }
  }
  Start-Process -FilePath $ollama -ArgumentList @("serve") -WindowStyle Hidden
  for ($i=0; $i -lt 90; $i++) {
    if (Get-Json "$OllamaUrl/api/tags") { return $ollama }
    Start-Sleep -Seconds 2
  }
  throw "The local AI runtime did not become ready."
}

function Ensure-Model([string]$OllamaExe) {
  $tags = Get-Json "$OllamaUrl/api/tags" 5
  $names = @($tags.models | ForEach-Object { $_.name })
  if ($names -contains $Model) { return }
  if (-not $OllamaExe) { $OllamaExe = Find-Ollama }
  if (-not $OllamaExe) { throw "Could not locate Ollama to download $Model." }
  Write-Host "Preparing owner model $Model (first run only)..."
  & $OllamaExe pull $Model
  if ($LASTEXITCODE -ne 0) { throw "Model download failed." }
}

if (-not (Test-Path $Python)) { throw "Portable Python runtime is missing." }
if (-not (Test-Path $App)) { throw "IZAKHONO WORK app.py is missing." }

Stop-StaleIzakhonoWork
$health = Get-Json $HealthUrl
if ($health -and $health.version -eq $ExpectedVersion) {
  Write-Host "IZAKHONO WORK $ExpectedVersion is already running."
  if (-not $NoBrowser) { Start-Process "http://127.0.0.1:9393" }
  exit 0
}

$ollama = Ensure-Ollama
Ensure-Model $ollama

New-Item -ItemType Directory -Force -Path $Data | Out-Null
$env:IZAKHONO_WORK_HOST = "127.0.0.1"
$env:IZAKHONO_WORK_PORT = "9393"
$env:IZAKHONO_WORK_TOKEN = ""
$env:IZAKHONO_WORK_DATA = $Data
$env:IZAKHONO_OLLAMA_URL = $OllamaUrl
$env:IZAKHONO_WORK_MODEL = $Model
$env:IZAKHONO_WORK_BUILDER_MODEL = $Model

$logDir = Join-Path $env:LOCALAPPDATA "IzakhonoWork\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stdout = Join-Path $logDir "izakhono-work.out.log"
$stderr = Join-Path $logDir "izakhono-work.err.log"

Start-Process -FilePath $Python -ArgumentList @($App) -WorkingDirectory $Root -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr

for ($i=0; $i -lt 60; $i++) {
  $health = Get-Json $HealthUrl
  if ($health -and $health.ok -and $health.version -eq $ExpectedVersion) {
    Write-Host ""
    Write-Host "IZAKHONO_WORK_OWNER_NODE=READY"
    Write-Host "Version: $ExpectedVersion"
    Write-Host "Workspace: http://127.0.0.1:9393"
    Write-Host "Model: $Model"
    Write-Host "No usage-credit gate."

    $desktop = [Environment]::GetFolderPath("Desktop")
    if ($desktop) {
      $shortcut = Join-Path $desktop "IZAKHONO WORK.url"
      @"
[InternetShortcut]
URL=http://127.0.0.1:9393
"@ | Set-Content -Path $shortcut -Encoding ASCII
    }

    $startup = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
    if (Test-Path $startup) {
      $startupCmd = Join-Path $startup "IZAKHONO WORK.cmd"
      @"
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$PSCommandPath" -NoBrowser
"@ | Set-Content -Path $startupCmd -Encoding ASCII
    }

    if (-not $NoBrowser) { Start-Process "http://127.0.0.1:9393" }
    exit 0
  }
  Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "IZAKHONO_WORK_OWNER_NODE=FAILED"
if (Test-Path $stderr) { Get-Content $stderr -Tail 40 }
throw "IZAKHONO WORK did not become healthy."
