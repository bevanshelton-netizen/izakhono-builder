$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 20 or newer is required.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Git for Windows is required.' }
$data = Join-Path $env:ProgramData 'Izakhono\Code'
New-Item -ItemType Directory -Force -Path $data | Out-Null
$tokenFile = Join-Path $data 'owner-token.txt'
if (-not (Test-Path $tokenFile)) { [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) | Set-Content -NoNewline $tokenFile }
$env:IZAKHONO_CODE_OWNER_TOKEN = Get-Content $tokenFile -Raw
$env:IZAKHONO_CODE_DATA = Join-Path $data 'data'
$env:HOST = '127.0.0.1'; $env:PORT = '4177'
Write-Host 'Starting IZAKHONO CODE Complete Alpha on this owner laptop...'
Start-Process 'http://127.0.0.1:4177'
node (Join-Path $root 'src\server.mjs')
