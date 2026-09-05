#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Model = "qwen3:4b"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Root = Join-Path $env:LOCALAPPDATA "IzakhonoWork"
$Data = Join-Path $Root "data"
$App = Join-Path $Root "app.py"
$Builder = Join-Path $Root "builder_core.py"
$StartScript = Join-Path $Root "start-izakhono-work.ps1"
$Log = Join-Path ([Environment]::GetFolderPath("Desktop")) "IZAKHONO-WORK-TAKEOVER.log"
$AppUrl = "https://raw.githubusercontent.com/bevanshelton-netizen/izakhono-builder/main/products/izakhono-work/app.py"
$BuilderUrl = "https://raw.githubusercontent.com/bevanshelton-netizen/izakhono-builder/main/products/izakhono-work/builder_core.py"

function Write-Log([string]$Message) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $line = "[" + $stamp + "] " + $Message
  Write-Host $line
  Add-Content -Path $Log -Value $line -Encoding UTF8
}

function Fail([string]$Message, [int]$Code = 1) {
  Write-Log ("FAILED: " + $Message)
  Write-Host ""
  Write-Host ("IZAKHONO WORK TAKEOVER FAILED - CODE " + $Code) -ForegroundColor Red
  Write-Host ("Log: " + $Log)
  exit $Code
}

function Http-Get([string]$Url, [int]$Timeout = 5) {
  try {
    return Invoke-RestMethod -Uri $Url -TimeoutSec $Timeout
  } catch {
    return $null
  }
}

function Find-Ollama {
  $cmd = Get-Command ollama.exe -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source)) { return $cmd.Source }
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"),
    (Join-Path $env:ProgramFiles "Ollama\ollama.exe")
  )
  foreach ($p in $candidates) { if ($p -and (Test-Path $p)) { return $p } }
  return $null
}

function Test-Python([string]$Path) {
  if (-not $Path) { return $false }
  if ($Path -match "\\WindowsApps\\") { return $false }
  if (-not (Test-Path $Path)) { return $false }
  try {
    $v = & $Path --version 2>&1
    return ($LASTEXITCODE -eq 0 -and (($v -join " ") -match "^Python\s+3\."))
  } catch {
    return $false
  }
}

function Find-Python {
  $roots = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Python"),
    (Join-Path $env:ProgramFiles "Python")
  )
  foreach ($root in $roots) {
    if ($root -and (Test-Path $root)) {
      $hits = Get-ChildItem $root -Recurse -Filter python.exe -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending
      foreach ($hit in $hits) {
        if (Test-Python $hit.FullName) { return $hit.FullName }
      }
    }
  }
  $cmd = Get-Command python.exe -ErrorAction SilentlyContinue
  if ($cmd -and (Test-Python $cmd.Source)) { return $cmd.Source }
  return $null
}

function Ensure-Winget {
  $cmd = Get-Command winget.exe -ErrorAction SilentlyContinue
  if (-not $cmd) { Fail "Windows Package Manager (winget) is not available." 20 }
  return $cmd.Source
}

function Start-Ollama([string]$Ollama) {
  if (Http-Get "http://127.0.0.1:11434/api/tags" 3) { return }
  Write-Log "Starting local model runtime..."
  Start-Process -FilePath $Ollama -ArgumentList @("serve") -WindowStyle Hidden
  for ($i=0; $i -lt 60; $i++) {
    if (Http-Get "http://127.0.0.1:11434/api/tags" 3) { return }
    Start-Sleep -Seconds 2
  }
  Fail "Local model runtime did not become healthy." 30
}

function Stop-ExistingIzakhonoWork {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:9393/healthz" -TimeoutSec 3
    if ($health.service -ne "izakhono-work") { return }
  } catch { return }

  try {
    $conn = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 9393 -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($conn -and $conn.OwningProcess) {
      Write-Log "Restarting the existing IZAKHONO WORK service with the latest app..."
      Stop-Process -Id $conn.OwningProcess -Force -ErrorAction Stop
      Start-Sleep -Seconds 1
    }
  } catch {
    Write-Log "Could not stop the existing listener cleanly; continuing with health checks."
  }
}

function Test-DirectModel([string]$ModelName) {
  Write-Log "Testing local model directly..."
  $payload = @{
    model = $ModelName
    stream = $false
    messages = @(@{ role = "user"; content = "Reply only: LOCAL MODEL OK" })
  } | ConvertTo-Json -Depth 6
  try {
    $r = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:11434/api/chat" -ContentType "application/json" -Body $payload -TimeoutSec 300
    $text = [string]$r.message.content
    if (-not $text) { Fail "Local model returned an empty response." 40 }
    Write-Log ("Local model test passed: " + $text)
  } catch {
    Fail ("Local model test failed: " + $_.Exception.Message) 41
  }
}

function Write-Startup([string]$Python, [string]$Ollama, [string]$ModelName) {
  $body = @'
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
  $body = $body.Replace("__OLLAMA__", $Ollama)
  $body = $body.Replace("__PYTHON__", $Python)
  $body = $body.Replace("__APP__", $App)
  $body = $body.Replace("__DATA__", $Data)
  $body = $body.Replace("__MODEL__", $ModelName)
  Set-Content -Path $StartScript -Value $body -Encoding UTF8

  $startup = [Environment]::GetFolderPath("Startup")
  $cmdPath = Join-Path $startup "IZAKHONO WORK.cmd"
  $cmd = "@echo off" + [Environment]::NewLine + "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ + $StartScript + """" + [Environment]::NewLine
  Set-Content -Path $cmdPath -Value $cmd -Encoding ASCII

  $desktop = [Environment]::GetFolderPath("Desktop")
  $shortcut = Join-Path $desktop "IZAKHONO WORK.url"
  @"
[InternetShortcut]
URL=http://127.0.0.1:9393
"@ | Set-Content -Path $shortcut -Encoding ASCII
}

function Start-IzakhonoWork([string]$Python, [string]$ModelName) {
  $env:IZAKHONO_WORK_HOST = "127.0.0.1"
  $env:IZAKHONO_WORK_PORT = "9393"
  $env:IZAKHONO_WORK_TOKEN = ""
  $env:IZAKHONO_WORK_DATA = $Data
  $env:IZAKHONO_OLLAMA_URL = "http://127.0.0.1:11434"
  $env:IZAKHONO_WORK_MODEL = $ModelName

  Write-Log "Starting IZAKHONO WORK..."
  Start-Process -FilePath $Python -ArgumentList @($App) -WindowStyle Hidden
  for ($i=0; $i -lt 60; $i++) {
    try {
      $h = Invoke-RestMethod -Uri "http://127.0.0.1:9393/healthz" -TimeoutSec 3
      if ($h.ok) { return }
    } catch {}
    Start-Sleep -Seconds 2
  }
  Fail "IZAKHONO WORK did not become healthy on port 9393." 50
}

function Test-IzakhonoChat {
  Write-Log "Testing browser-to-workspace-to-model chat path..."
  try {
    $conv = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:9393/api/conversations" -ContentType "application/json" -Body "{}" -TimeoutSec 10
    $body = @{
      conversation_id = [string]$conv.id
      message = "Reply only: OWNER NODE READY"
    } | ConvertTo-Json
    $reply = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:9393/api/chat" -ContentType "application/json" -Body $body -TimeoutSec 300
    if (-not $reply.answer) { Fail "IZAKHONO WORK returned no chat answer." 60 }
    Write-Log ("End-to-end chat passed: " + [string]$reply.answer)
  } catch {
    Fail ("End-to-end chat failed: " + $_.Exception.Message) 61
  }
}

try {
  Set-Content -Path $Log -Value "IZAKHONO WORK TAKEOVER" -Encoding UTF8
  Write-Log "Starting owner-node takeover repair."

  $winget = Ensure-Winget

  $ollama = Find-Ollama
  if (-not $ollama) {
    Write-Log "Installing local model runtime..."
    & $winget install --id Ollama.Ollama --exact --accept-package-agreements --accept-source-agreements --silent
    if ($LASTEXITCODE -ne 0) { Fail "Ollama installation failed." 21 }
    Start-Sleep -Seconds 3
    $ollama = Find-Ollama
    if (-not $ollama) { Fail "Ollama installed but could not be located." 22 }
  }

  $python = Find-Python
  if (-not $python) {
    Write-Log "Installing Python 3.13..."
    & $winget install --id Python.Python.3.13 --exact --accept-package-agreements --accept-source-agreements --silent
    if ($LASTEXITCODE -ne 0) { Fail "Python installation failed." 23 }
    Start-Sleep -Seconds 4
    $python = Find-Python
    if (-not $python) { Fail "Real Python runtime could not be located after installation." 24 }
  }

  Write-Log ("Python runtime: " + $python)
  Write-Log ("Model runtime: " + $ollama)

  New-Item -ItemType Directory -Force -Path $Root, $Data | Out-Null

  Write-Log "Downloading latest IZAKHONO WORK app and builder engine..."
  Invoke-WebRequest -UseBasicParsing -Uri $AppUrl -OutFile $App
  Invoke-WebRequest -UseBasicParsing -Uri $BuilderUrl -OutFile $Builder

  Start-Ollama $ollama

  Write-Log ("Ensuring owner model is installed: " + $Model)
  & $ollama pull $Model
  if ($LASTEXITCODE -ne 0) { Fail "Model download failed." 31 }

  Test-DirectModel $Model
  Stop-ExistingIzakhonoWork
  Write-Startup $python $ollama $Model
  Start-IzakhonoWork $python $Model
  Test-IzakhonoChat

  Write-Host ""
  Write-Host "============================================================" -ForegroundColor Green
  Write-Host "IZAKHONO WORK OWNER NODE = READY" -ForegroundColor Green
  Write-Host "============================================================" -ForegroundColor Green
  Write-Host "Workspace: http://127.0.0.1:9393"
  Write-Host ("Model: " + $Model)
  Write-Host "Starts automatically with Windows: YES"
  Write-Host "End-to-end local chat test: PASS"
  Write-Host "Local BUILD engine installed: YES"
  Write-Host ("Log: " + $Log)
  Write-Host ""
  Write-Log "Owner-node takeover completed successfully."
  Start-Process "http://127.0.0.1:9393"
} catch {
  Fail $_.Exception.Message 99
}
