$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$data = Join-Path $env:ProgramData 'Izakhono\Code'
$log = Join-Path $data 'startup-diagnostic.log'
$transcriptStarted = $false

try {
  New-Item -ItemType Directory -Force -Path $data | Out-Null
  try {
    Start-Transcript -Path $log -Append | Out-Null
    $transcriptStarted = $true
  }
  catch {
    Write-Host '[WARN] Diagnostic transcript is busy; startup will continue.' -ForegroundColor Yellow
  }
  Write-Host '==================================================' -ForegroundColor Green
  Write-Host ' IZAKHONO CODE - COMPLETE ALPHA OWNER NODE' -ForegroundColor Green
  Write-Host '==================================================' -ForegroundColor Green

  $node = Get-Command node -ErrorAction SilentlyContinue
  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $node) { throw 'Node.js 20 or newer is not installed or is not available in PATH.' }
  if (-not $git) { throw 'Git for Windows is not installed or is not available in PATH.' }

  $major = [int]((& node --version).TrimStart('v').Split('.')[0])
  if ($major -lt 20) { throw "Node.js 20 or newer is required. Installed version: $(& node --version)" }
  Write-Host "[PASS] Node.js $(& node --version)" -ForegroundColor Green
  Write-Host "[PASS] $(& git --version)" -ForegroundColor Green

  $tokenFile = Join-Path $data 'owner-token.txt'
  if (-not (Test-Path $tokenFile)) {
    $tokenBytes = New-Object byte[] 32
    $tokenGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
      $tokenGenerator.GetBytes($tokenBytes)
    }
    finally {
      $tokenGenerator.Dispose()
    }
    ([BitConverter]::ToString($tokenBytes) -replace '-', '') | Set-Content -NoNewline $tokenFile
  }
  $env:IZAKHONO_CODE_OWNER_TOKEN = Get-Content $tokenFile -Raw
  $env:IZAKHONO_CODE_DATA = Join-Path $data 'data'
  $env:HOST = '127.0.0.1'
  $env:PORT = '4177'
  $server = Join-Path $root 'src\server.mjs'
  if (-not (Test-Path $server)) { throw "Server file is missing: $server" }

  Write-Host '[START] http://127.0.0.1:4177' -ForegroundColor Cyan
  Start-Job -ScriptBlock { Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:4177' } | Out-Null
  & node $server
  if ($LASTEXITCODE -ne 0) { throw "IZAKHONO CODE stopped with exit code $LASTEXITCODE." }
}
catch {
  Write-Host ''
  Write-Host "[BLOCKED] $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Diagnostic log: $log" -ForegroundColor Yellow
  Write-Host 'The window will remain open so this message can be read.' -ForegroundColor Yellow
  exit 1
}
finally {
  if ($transcriptStarted) {
    try { Stop-Transcript | Out-Null } catch {}
  }
}
